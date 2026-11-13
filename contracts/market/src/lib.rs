//! Haggletown market contract.
//!
//! - **Items** are multi-tokens (NEP-245 style balances, views and events), each with an owner-set
//!   price band. No trade can happen outside that band, whatever the AI says.
//! - **NPC merchants** are registered NEAR accounts with an internal NEAR balance, a per-trade limit,
//!   a daily spending limit and an on/off switch. Their function-call keys can only make, cancel and
//!   accept offers. They cannot withdraw NEAR or transfer items (`mt_transfer` needs 1 yoctoNEAR,
//!   which function-call keys cannot attach).
//! - **Trades** are two-step: an NPC posts an offer (the price it haggled to), and the named
//!   counterparty accepts it. Players pay with attached NEAR; NPCs pay from their internal balance.

use std::collections::BTreeMap;

use near_sdk::json_types::U128;
use near_sdk::serde_json::{self, json};
use near_sdk::store::{IterableMap, LookupMap};
use near_sdk::{assert_one_yocto, env, near, require, AccountId, NearToken, PanicOnDefault, Promise};

pub type ItemId = String;
pub type OfferId = u64;

const NANOS_PER_DAY: u64 = 86_400_000_000_000;
const MAX_OFFER_TTL_MINUTES: u32 = 60;
const MAX_OPEN_OFFERS_PER_NPC: u32 = 25;
const MAX_ITEMS: u32 = 32;
const MAX_ITEM_ID_LEN: usize = 32;

#[near(serializers = [borsh, json])]
#[derive(Clone)]
pub struct Item {
    pub name: String,
    /// Lowest unit price (yoctoNEAR) any trade of this item may use.
    pub min_price: U128,
    /// Highest unit price (yoctoNEAR) any trade of this item may use.
    pub max_price: U128,
    pub total_supply: U128,
}

#[near(serializers = [borsh, json])]
#[derive(Clone)]
pub struct NpcLimits {
    /// Most an NPC may spend in one trade (yoctoNEAR).
    pub max_per_trade: U128,
    /// Most an NPC may spend per UTC day (yoctoNEAR).
    pub max_per_day: U128,
}

#[near(serializers = [borsh])]
pub struct Npc {
    limits: NpcLimits,
    balance: u128,
    spent_today: u128,
    day: u64,
    open_offers: u32,
    active: bool,
}

#[near(serializers = [json])]
pub struct NpcView {
    pub account_id: AccountId,
    pub limits: NpcLimits,
    pub balance: U128,
    pub spent_today: U128,
    pub open_offers: u32,
    pub active: bool,
}

#[near(serializers = [borsh, json])]
#[derive(Clone, Copy, PartialEq, Debug)]
pub enum Side {
    /// The NPC sells items to the counterparty.
    NpcSells,
    /// The NPC buys items from the counterparty.
    NpcBuys,
}

#[near(serializers = [borsh, json])]
#[derive(Clone)]
pub struct Offer {
    pub id: OfferId,
    pub npc: AccountId,
    pub counterparty: AccountId,
    pub item_id: ItemId,
    pub quantity: u32,
    pub unit_price: U128,
    pub side: Side,
    pub expires_at_ms: u64,
}

#[near(contract_state)]
#[derive(PanicOnDefault)]
pub struct Market {
    owner: AccountId,
    items: IterableMap<ItemId, Item>,
    npcs: IterableMap<AccountId, Npc>,
    inventories: LookupMap<AccountId, BTreeMap<ItemId, u128>>,
    offers: IterableMap<OfferId, Offer>,
    next_offer_id: OfferId,
}

#[near]
impl Market {
    #[init]
    pub fn new(owner: AccountId) -> Self {
        Self {
            owner,
            items: IterableMap::new(b"i"),
            npcs: IterableMap::new(b"n"),
            inventories: LookupMap::new(b"v"),
            offers: IterableMap::new(b"o"),
            next_offer_id: 1,
        }
    }

    // ------------------------------------------------------------------ owner

    pub fn add_item(&mut self, item_id: ItemId, name: String, min_price: U128, max_price: U128) {
        self.assert_owner();
        require!(!item_id.is_empty() && item_id.len() <= MAX_ITEM_ID_LEN, "Bad item id");
        require!(self.items.get(&item_id).is_none(), "Item already exists");
        require!(self.items.len() < MAX_ITEMS, "Too many items");
        require!(min_price.0 > 0 && min_price.0 <= max_price.0, "Bad price band");
        self.items.insert(item_id, Item { name, min_price, max_price, total_supply: U128(0) });
    }

    pub fn set_price_band(&mut self, item_id: ItemId, min_price: U128, max_price: U128) {
        self.assert_owner();
        require!(min_price.0 > 0 && min_price.0 <= max_price.0, "Bad price band");
        let item = self.items.get_mut(&item_id).unwrap_or_else(|| env::panic_str("Unknown item"));
        item.min_price = min_price;
        item.max_price = max_price;
    }

    pub fn register_npc(&mut self, npc: AccountId, limits: NpcLimits) {
        self.assert_owner();
        require!(npc != self.owner, "Owner cannot be an NPC");
        require!(self.npcs.get(&npc).is_none(), "NPC already registered");
        self.npcs.insert(
            npc,
            Npc { limits, balance: 0, spent_today: 0, day: today(), open_offers: 0, active: true },
        );
    }

    pub fn set_npc_limits(&mut self, npc: AccountId, limits: NpcLimits) {
        self.assert_owner();
        self.npc_mut(&npc).limits = limits;
    }

    /// Kill switch: an inactive NPC cannot make or accept offers, and its open offers cannot be accepted.
    pub fn set_npc_active(&mut self, npc: AccountId, active: bool) {
        self.assert_owner();
        self.npc_mut(&npc).active = active;
    }

    /// Owner adds NEAR to an NPC's trading balance.
    #[payable]
    pub fn fund_npc(&mut self, npc: AccountId) {
        self.assert_owner();
        let amount = env::attached_deposit().as_yoctonear();
        require!(amount > 0, "Attach NEAR to fund the NPC");
        self.npc_mut(&npc).balance += amount;
    }

    /// Owner pulls NEAR out of an NPC's balance back to the owner account.
    pub fn withdraw_npc(&mut self, npc: AccountId, amount: U128) -> Promise {
        self.assert_owner();
        let state = self.npc_mut(&npc);
        require!(amount.0 > 0 && amount.0 <= state.balance, "Bad amount");
        state.balance -= amount.0;
        Promise::new(self.owner.clone()).transfer(NearToken::from_yoctonear(amount.0))
    }

    /// Owner creates new items (restocking an NPC, or a starter pack for a player).
    pub fn mint(&mut self, to: AccountId, item_id: ItemId, amount: U128) {
        self.assert_owner();
        require!(amount.0 > 0, "Amount must be positive");
        let item = self.items.get_mut(&item_id).unwrap_or_else(|| env::panic_str("Unknown item"));
        item.total_supply = U128(item.total_supply.0 + amount.0);
        self.give_items(&to, &item_id, amount.0);
        emit_nep245(
            "mt_mint",
            json!({ "owner_id": to, "token_ids": [item_id], "amounts": [amount] }),
        );
    }

    // ------------------------------------------------------------------ NPC

    /// An NPC posts the price it haggled to. Checked against the item's price band and,
    /// for NPC purchases, the NPC's limits and balance.
    pub fn make_offer(
        &mut self,
        counterparty: AccountId,
        item_id: ItemId,
        quantity: u32,
        unit_price: U128,
        side: Side,
        ttl_minutes: u32,
    ) -> OfferId {
        let npc_id = env::predecessor_account_id();
        require!(counterparty != npc_id, "Cannot trade with yourself");
        require!(quantity > 0, "Quantity must be positive");
        require!(ttl_minutes > 0 && ttl_minutes <= MAX_OFFER_TTL_MINUTES, "Bad ttl");
        self.assert_price_in_band(&item_id, unit_price.0);
        let total = total_price(quantity, unit_price.0);

        match side {
            Side::NpcSells => {
                require!(self.balance_of(&npc_id, &item_id) >= quantity as u128, "NPC lacks the items");
            }
            Side::NpcBuys => self.assert_npc_can_spend(&npc_id, total),
        }

        let npc = self.npcs.get_mut(&npc_id).unwrap_or_else(|| env::panic_str("Caller is not an NPC"));
        require!(npc.active, "NPC is paused");
        require!(npc.open_offers < MAX_OPEN_OFFERS_PER_NPC, "Too many open offers");
        npc.open_offers += 1;

        let id = self.next_offer_id;
        self.next_offer_id += 1;
        let offer = Offer {
            id,
            npc: npc_id,
            counterparty,
            item_id,
            quantity,
            unit_price,
            side,
            expires_at_ms: env::block_timestamp_ms() + ttl_minutes as u64 * 60_000,
        };
        emit_market("offer_created", serde_json::to_value(&offer).unwrap());
        self.offers.insert(id, offer);
        id
    }

    /// The NPC that made an offer, or the owner, withdraws it.
    pub fn cancel_offer(&mut self, offer_id: OfferId) {
        let offer = self.offers.get(&offer_id).cloned().unwrap_or_else(|| env::panic_str("Unknown offer"));
        let caller = env::predecessor_account_id();
        require!(caller == offer.npc || caller == self.owner, "Not your offer");
        self.close_offer(&offer);
        emit_market("offer_cancelled", json!({ "id": offer_id }));
    }

    /// Anyone can clear up to `limit` expired offers.
    pub fn prune_expired(&mut self, limit: u32) -> u32 {
        let now = env::block_timestamp_ms();
        let expired: Vec<Offer> = self
            .offers
            .values()
            .filter(|o| o.expires_at_ms <= now)
            .take(limit as usize)
            .cloned()
            .collect();
        for offer in &expired {
            self.close_offer(offer);
        }
        expired.len() as u32
    }

    // ------------------------------------------------------------------ trading

    /// The named counterparty accepts an offer. Players buying attach at least the total price
    /// (any excess is refunded); NPCs pay from their internal balance and attach nothing.
    #[payable]
    pub fn accept_offer(&mut self, offer_id: OfferId) {
        let offer = self.offers.get(&offer_id).cloned().unwrap_or_else(|| env::panic_str("Unknown offer"));
        let caller = env::predecessor_account_id();
        require!(caller == offer.counterparty, "This offer is not for you");
        require!(env::block_timestamp_ms() < offer.expires_at_ms, "Offer expired");
        require!(self.npc(&offer.npc).active, "NPC is paused");
        // Re-check the band in case the owner tightened it after the offer was made.
        self.assert_price_in_band(&offer.item_id, offer.unit_price.0);

        let qty = offer.quantity as u128;
        let total = total_price(offer.quantity, offer.unit_price.0);
        let deposit = env::attached_deposit().as_yoctonear();
        let caller_is_npc = self.npcs.get(&caller).is_some();
        self.close_offer(&offer);

        let (buyer, seller) = match offer.side {
            Side::NpcSells => (caller.clone(), offer.npc.clone()),
            Side::NpcBuys => (offer.npc.clone(), caller.clone()),
        };

        // Move the items first: fails the whole call if the seller no longer has them.
        self.take_items(&seller, &offer.item_id, qty);
        self.give_items(&buyer, &offer.item_id, qty);

        // Buyer pays.
        let buyer_is_npc = match offer.side {
            Side::NpcSells => caller_is_npc,
            Side::NpcBuys => true,
        };
        if buyer_is_npc {
            require!(deposit == 0, "NPC buyers pay from their balance; attach no NEAR");
            self.spend(&buyer, total);
        } else {
            require!(deposit >= total, "Attached NEAR is less than the price");
            if deposit > total {
                let _ = Promise::new(caller.clone()).transfer(NearToken::from_yoctonear(deposit - total));
            }
        }

        // Seller is paid.
        if self.npcs.get(&seller).is_some() {
            self.npc_mut(&seller).balance += total;
        } else {
            let _ = Promise::new(seller.clone()).transfer(NearToken::from_yoctonear(total));
        }

        emit_nep245(
            "mt_transfer",
            json!({
                "old_owner_id": seller,
                "new_owner_id": buyer,
                "token_ids": [offer.item_id],
                "amounts": [U128(qty)],
            }),
        );
        emit_market(
            "trade",
            json!({
                "offer_id": offer.id,
                "buyer": buyer,
                "seller": seller,
                "item_id": offer.item_id,
                "quantity": offer.quantity,
                "unit_price": offer.unit_price,
                "total": U128(total),
            }),
        );
    }

    // ------------------------------------------------------------------ NEP-245 (subset)

    /// Transfer items you own. Needs exactly 1 yoctoNEAR, so function-call keys (the NPCs' keys) cannot use it.
    /// The receiver must be an NPC or already hold items (keeps storage spam out).
    #[payable]
    pub fn mt_transfer(
        &mut self,
        receiver_id: AccountId,
        token_id: ItemId,
        amount: U128,
        approval: Option<(AccountId, u64)>,
        memo: Option<String>,
    ) {
        assert_one_yocto();
        require!(approval.is_none(), "Approvals are not supported");
        let sender = env::predecessor_account_id();
        require!(sender != receiver_id, "Cannot transfer to yourself");
        require!(amount.0 > 0, "Amount must be positive");
        require!(
            self.npcs.get(&receiver_id).is_some() || self.inventories.get(&receiver_id).is_some(),
            "Receiver has no inventory yet"
        );
        self.take_items(&sender, &token_id, amount.0);
        self.give_items(&receiver_id, &token_id, amount.0);
        emit_nep245(
            "mt_transfer",
            json!({
                "old_owner_id": sender,
                "new_owner_id": receiver_id,
                "token_ids": [token_id],
                "amounts": [amount],
                "memo": memo,
            }),
        );
    }

    pub fn mt_balance_of(&self, account_id: AccountId, token_id: ItemId) -> U128 {
        U128(self.balance_of(&account_id, &token_id))
    }

    pub fn mt_batch_balance_of(&self, account_id: AccountId, token_ids: Vec<ItemId>) -> Vec<U128> {
        token_ids.iter().map(|t| U128(self.balance_of(&account_id, t))).collect()
    }

    pub fn mt_supply(&self, token_id: ItemId) -> Option<U128> {
        self.items.get(&token_id).map(|i| i.total_supply)
    }

    // ------------------------------------------------------------------ views

    pub fn get_owner(&self) -> AccountId {
        self.owner.clone()
    }

    pub fn get_items(&self) -> Vec<(ItemId, Item)> {
        self.items.iter().map(|(k, v)| (k.clone(), v.clone())).collect()
    }

    pub fn inventory_of(&self, account_id: AccountId) -> BTreeMap<ItemId, U128> {
        self.inventories
            .get(&account_id)
            .map(|inv| inv.iter().map(|(k, v)| (k.clone(), U128(*v))).collect())
            .unwrap_or_default()
    }

    pub fn get_npc(&self, account_id: AccountId) -> Option<NpcView> {
        self.npcs.get(&account_id).map(|n| npc_view(&account_id, n))
    }

    pub fn get_npcs(&self) -> Vec<NpcView> {
        self.npcs.iter().map(|(id, n)| npc_view(id, n)).collect()
    }

    pub fn get_offer(&self, offer_id: OfferId) -> Option<Offer> {
        self.offers.get(&offer_id).cloned()
    }

    pub fn get_offers(&self, from_index: Option<u32>, limit: Option<u32>) -> Vec<Offer> {
        self.offers
            .values()
            .skip(from_index.unwrap_or(0) as usize)
            .take(limit.unwrap_or(50).min(100) as usize)
            .cloned()
            .collect()
    }

    // ------------------------------------------------------------------ internal

    fn assert_owner(&self) {
        require!(env::predecessor_account_id() == self.owner, "Only the owner can do this");
    }

    fn npc(&self, id: &AccountId) -> &Npc {
        self.npcs.get(id).unwrap_or_else(|| env::panic_str("Unknown NPC"))
    }

    fn npc_mut(&mut self, id: &AccountId) -> &mut Npc {
        self.npcs.get_mut(id).unwrap_or_else(|| env::panic_str("Unknown NPC"))
    }

    fn assert_price_in_band(&self, item_id: &ItemId, unit_price: u128) {
        let item = self.items.get(item_id).unwrap_or_else(|| env::panic_str("Unknown item"));
        require!(
            unit_price >= item.min_price.0 && unit_price <= item.max_price.0,
            "Price is outside the item's allowed band"
        );
    }

    fn assert_npc_can_spend(&self, id: &AccountId, amount: u128) {
        let npc = self.npc(id);
        let spent = if npc.day == today() { npc.spent_today } else { 0 };
        require!(npc.active, "NPC is paused");
        require!(amount <= npc.limits.max_per_trade.0, "Over the NPC's per-trade limit");
        require!(spent + amount <= npc.limits.max_per_day.0, "Over the NPC's daily limit");
        require!(amount <= npc.balance, "NPC balance too low");
    }

    fn spend(&mut self, id: &AccountId, amount: u128) {
        self.assert_npc_can_spend(id, amount);
        let npc = self.npc_mut(id);
        let day = today();
        if npc.day != day {
            npc.day = day;
            npc.spent_today = 0;
        }
        npc.spent_today += amount;
        npc.balance -= amount;
    }

    fn close_offer(&mut self, offer: &Offer) {
        self.offers.remove(&offer.id);
        if let Some(npc) = self.npcs.get_mut(&offer.npc) {
            npc.open_offers = npc.open_offers.saturating_sub(1);
        }
    }

    fn balance_of(&self, account: &AccountId, item_id: &ItemId) -> u128 {
        self.inventories.get(account).and_then(|inv| inv.get(item_id).copied()).unwrap_or(0)
    }

    fn take_items(&mut self, owner: &AccountId, item_id: &ItemId, amount: u128) {
        let mut inv = self.inventories.get(owner).cloned().unwrap_or_default();
        let have = inv.get(item_id).copied().unwrap_or(0);
        require!(have >= amount, "Not enough items");
        if have == amount {
            inv.remove(item_id);
        } else {
            inv.insert(item_id.clone(), have - amount);
        }
        // Keep an empty inventory so the account still counts as a known holder.
        self.inventories.insert(owner.clone(), inv);
    }

    fn give_items(&mut self, owner: &AccountId, item_id: &ItemId, amount: u128) {
        require!(self.items.get(item_id).is_some(), "Unknown item");
        let mut inv = self.inventories.get(owner).cloned().unwrap_or_default();
        *inv.entry(item_id.clone()).or_insert(0) += amount;
        self.inventories.insert(owner.clone(), inv);
    }
}

fn npc_view(id: &AccountId, n: &Npc) -> NpcView {
    NpcView {
        account_id: id.clone(),
        limits: n.limits.clone(),
        balance: U128(n.balance),
        spent_today: U128(if n.day == today() { n.spent_today } else { 0 }),
        open_offers: n.open_offers,
        active: n.active,
    }
}

fn total_price(quantity: u32, unit_price: u128) -> u128 {
    unit_price.checked_mul(quantity as u128).unwrap_or_else(|| env::panic_str("Price overflow"))
}

fn today() -> u64 {
    env::block_timestamp() / NANOS_PER_DAY
}

fn emit_nep245(event: &str, data: serde_json::Value) {
    emit("nep245", event, data);
}

fn emit_market(event: &str, data: serde_json::Value) {
    emit("haggletown", event, data);
}

fn emit(standard: &str, event: &str, data: serde_json::Value) {
    let payload = json!({ "standard": standard, "version": "1.0.0", "event": event, "data": [data] });
    env::log_str(&format!("EVENT_JSON:{payload}"));
}

#[cfg(test)]
mod tests;
