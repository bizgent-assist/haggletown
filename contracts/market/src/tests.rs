use super::*;
use near_sdk::test_utils::VMContextBuilder;
use near_sdk::testing_env;

const MINUTE_NS: u64 = 60_000_000_000;

fn acc(s: &str) -> AccountId {
    s.parse().unwrap()
}
fn owner() -> AccountId {
    acc("owner.testnet")
}
fn mira() -> AccountId {
    acc("mira.market.testnet")
}
fn grob() -> AccountId {
    acc("grob.market.testnet")
}
fn alice() -> AccountId {
    acc("alice.testnet")
}
fn near(n: u128) -> u128 {
    NearToken::from_near(n).as_yoctonear()
}

fn call(as_: AccountId, deposit: u128, now_ns: u64) {
    testing_env!(VMContextBuilder::new()
        .predecessor_account_id(as_)
        .attached_deposit(NearToken::from_yoctonear(deposit))
        .block_timestamp(now_ns)
        .build());
}

/// Market with one item (potion, 1–5 NEAR), Mira holding 5 potions,
/// Grob funded with 10 NEAR (3 per trade, 5 per day).
fn setup() -> Market {
    call(owner(), 0, 0);
    let mut m = Market::new(owner());
    m.add_item("potion".into(), "Potion".into(), U128(near(1)), U128(near(5)));
    let limits = NpcLimits { max_per_trade: U128(near(3)), max_per_day: U128(near(5)) };
    m.register_npc(mira(), limits.clone());
    m.register_npc(grob(), limits);
    m.mint(mira(), "potion".into(), U128(5));
    call(owner(), near(10), 0);
    m.fund_npc(grob());
    m
}

#[test]
fn npc_sells_to_player() {
    let mut m = setup();
    call(mira(), 0, 0);
    let id = m.make_offer(alice(), "potion".into(), 2, U128(near(2)), Side::NpcSells, 10);
    call(alice(), near(4), MINUTE_NS);
    m.accept_offer(id);
    assert_eq!(m.mt_balance_of(alice(), "potion".into()).0, 2);
    assert_eq!(m.mt_balance_of(mira(), "potion".into()).0, 3);
    assert_eq!(m.get_npc(mira()).unwrap().balance.0, near(4));
    assert!(m.get_offer(id).is_none());
    assert_eq!(m.get_npc(mira()).unwrap().open_offers, 0);
}

#[test]
fn npc_buys_from_player() {
    let mut m = setup();
    call(owner(), 0, 0);
    m.mint(alice(), "potion".into(), U128(1));
    call(grob(), 0, 0);
    let id = m.make_offer(alice(), "potion".into(), 1, U128(near(2)), Side::NpcBuys, 10);
    call(alice(), 0, MINUTE_NS);
    m.accept_offer(id);
    assert_eq!(m.mt_balance_of(grob(), "potion".into()).0, 1);
    assert_eq!(m.mt_balance_of(alice(), "potion".into()).0, 0);
    let g = m.get_npc(grob()).unwrap();
    assert_eq!(g.balance.0, near(8));
    assert_eq!(g.spent_today.0, near(2));
}

#[test]
fn npc_to_npc_trade_uses_internal_balances() {
    let mut m = setup();
    call(mira(), 0, 0);
    let id = m.make_offer(grob(), "potion".into(), 1, U128(near(3)), Side::NpcSells, 10);
    call(grob(), 0, MINUTE_NS);
    m.accept_offer(id);
    assert_eq!(m.get_npc(grob()).unwrap().balance.0, near(7));
    assert_eq!(m.get_npc(mira()).unwrap().balance.0, near(3));
    assert_eq!(m.mt_balance_of(grob(), "potion".into()).0, 1);
}

#[test]
#[should_panic(expected = "outside the item's allowed band")]
fn rejects_price_below_band() {
    let mut m = setup();
    call(mira(), 0, 0);
    m.make_offer(alice(), "potion".into(), 1, U128(1), Side::NpcSells, 10);
}

#[test]
#[should_panic(expected = "per-trade limit")]
fn enforces_per_trade_limit() {
    let mut m = setup();
    call(grob(), 0, 0);
    // 2 potions at 2 NEAR = 4 NEAR, over the 3 NEAR per-trade limit.
    m.make_offer(alice(), "potion".into(), 2, U128(near(2)), Side::NpcBuys, 10);
}

#[test]
#[should_panic(expected = "daily limit")]
fn enforces_daily_limit() {
    let mut m = setup();
    call(owner(), 0, 0);
    m.mint(alice(), "potion".into(), U128(3));
    for _ in 0..2 {
        call(grob(), 0, 0);
        let id = m.make_offer(alice(), "potion".into(), 1, U128(near(3)), Side::NpcBuys, 10);
        call(alice(), 0, 0);
        m.accept_offer(id); // second one would take Grob to 6 NEAR > 5 NEAR daily
    }
}

#[test]
fn daily_limit_resets_next_day() {
    let mut m = setup();
    call(owner(), 0, 0);
    m.mint(alice(), "potion".into(), U128(2));
    let day = 86_400_000_000_000;
    for t in [0, day] {
        call(grob(), 0, t);
        let id = m.make_offer(alice(), "potion".into(), 1, U128(near(3)), Side::NpcBuys, 10);
        call(alice(), 0, t);
        m.accept_offer(id);
    }
    assert_eq!(m.mt_balance_of(grob(), "potion".into()).0, 2);
}

#[test]
#[should_panic(expected = "not for you")]
fn only_counterparty_can_accept() {
    let mut m = setup();
    call(mira(), 0, 0);
    let id = m.make_offer(alice(), "potion".into(), 1, U128(near(2)), Side::NpcSells, 10);
    call(acc("eve.testnet"), near(2), 0);
    m.accept_offer(id);
}

#[test]
#[should_panic(expected = "Offer expired")]
fn expired_offer_cannot_be_accepted() {
    let mut m = setup();
    call(mira(), 0, 0);
    let id = m.make_offer(alice(), "potion".into(), 1, U128(near(2)), Side::NpcSells, 1);
    call(alice(), near(2), 2 * MINUTE_NS);
    m.accept_offer(id);
}

#[test]
#[should_panic(expected = "less than the price")]
fn player_must_pay_full_price() {
    let mut m = setup();
    call(mira(), 0, 0);
    let id = m.make_offer(alice(), "potion".into(), 1, U128(near(2)), Side::NpcSells, 10);
    call(alice(), near(1), 0);
    m.accept_offer(id);
}

#[test]
#[should_panic(expected = "NPC is paused")]
fn paused_npc_offers_cannot_be_accepted() {
    let mut m = setup();
    call(mira(), 0, 0);
    let id = m.make_offer(alice(), "potion".into(), 1, U128(near(2)), Side::NpcSells, 10);
    call(owner(), 0, 0);
    m.set_npc_active(mira(), false);
    call(alice(), near(2), 0);
    m.accept_offer(id);
}

#[test]
#[should_panic(expected = "Only the owner")]
fn only_owner_can_mint() {
    let mut m = setup();
    call(mira(), 0, 0);
    m.mint(mira(), "potion".into(), U128(100));
}

#[test]
#[should_panic(expected = "Caller is not an NPC")]
fn players_cannot_make_offers() {
    let mut m = setup();
    call(owner(), 0, 0);
    m.mint(alice(), "potion".into(), U128(1));
    call(alice(), 0, 0);
    m.make_offer(mira(), "potion".into(), 1, U128(near(2)), Side::NpcSells, 10);
}

#[test]
fn prune_removes_expired_offers() {
    let mut m = setup();
    call(mira(), 0, 0);
    m.make_offer(alice(), "potion".into(), 1, U128(near(2)), Side::NpcSells, 1);
    call(alice(), 0, 2 * MINUTE_NS);
    assert_eq!(m.prune_expired(10), 1);
    assert_eq!(m.get_offers(None, None).len(), 0);
    assert_eq!(m.get_npc(mira()).unwrap().open_offers, 0);
}

#[test]
fn mt_transfer_moves_items_between_holders() {
    let mut m = setup();
    call(owner(), 0, 0);
    m.mint(alice(), "potion".into(), U128(2));
    call(alice(), 1, 0);
    m.mt_transfer(mira(), "potion".into(), U128(1), None, None);
    assert_eq!(m.mt_balance_of(alice(), "potion".into()).0, 1);
    assert_eq!(m.mt_balance_of(mira(), "potion".into()).0, 6);
}

#[test]
#[should_panic(expected = "Requires attached deposit of exactly 1 yoctoNEAR")]
fn mt_transfer_needs_one_yocto() {
    let mut m = setup();
    call(mira(), 0, 0);
    m.mt_transfer(grob(), "potion".into(), U128(1), None, None);
}
