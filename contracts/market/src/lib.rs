//! Haggletown market contract (skeleton).
//!
//! Holds item balances per account (multi-token style, to grow into NEP-245),
//! registers NPC merchants with on-chain spending limits, and settles trades.
//! The AI never gets an unrestricted key: an NPC's function-call key can only
//! call `npc_trade`, and the contract checks the per-trade and daily limits.

use near_sdk::store::{IterableMap, LookupMap};
use near_sdk::{env, near, require, AccountId, NearToken, PanicOnDefault};

pub type ItemId = String;

#[near(serializers = [borsh, json])]
#[derive(Clone)]
pub struct NpcLimits {
    pub max_per_trade: NearToken,
    pub max_per_day: NearToken,
}

#[near(serializers = [borsh])]
pub struct NpcState {
    pub limits: NpcLimits,
    pub spent_today: NearToken,
    pub day: u64,
}

#[near(contract_state)]
#[derive(PanicOnDefault)]
pub struct Market {
    owner: AccountId,
    /// (account, item) -> quantity
    balances: LookupMap<(AccountId, ItemId), u64>,
    npcs: IterableMap<AccountId, NpcState>,
}

#[near]
impl Market {
    #[init]
    pub fn new(owner: AccountId) -> Self {
        Self {
            owner,
            balances: LookupMap::new(b"b"),
            npcs: IterableMap::new(b"n"),
        }
    }

    /// Owner registers an NPC merchant account with its spending limits.
    pub fn register_npc(&mut self, npc: AccountId, limits: NpcLimits) {
        self.assert_owner();
        self.npcs.insert(npc, NpcState { limits, spent_today: NearToken::from_yoctonear(0), day: today() });
    }

    /// Owner mints starting stock for an NPC (restocking).
    pub fn mint(&mut self, to: AccountId, item_id: ItemId, quantity: u64) {
        self.assert_owner();
        let key = (to, item_id);
        let current = self.balances.get(&key).copied().unwrap_or(0);
        self.balances.insert(key, current + quantity);
    }

    pub fn balance_of(&self, account_id: AccountId, item_id: ItemId) -> u64 {
        self.balances.get(&(account_id, item_id)).copied().unwrap_or(0)
    }

    pub fn npc_limits(&self, npc: AccountId) -> Option<NpcLimits> {
        self.npcs.get(&npc).map(|s| s.limits.clone())
    }

    // Next: player_buy (payable), player_sell, npc_trade (limit-checked),
    // NEP-245 mt_transfer / mt_balance_of views, and trade events.

    fn assert_owner(&self) {
        require!(env::predecessor_account_id() == self.owner, "Only the owner can do this");
    }
}

fn today() -> u64 {
    env::block_timestamp() / 86_400_000_000_000
}
