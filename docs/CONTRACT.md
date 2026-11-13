# Market contract interface

Source: [contracts/market/src/lib.rs](../contracts/market/src/lib.rs). Prices and balances are yoctoNEAR strings (`U128`).

## Safety model
- **Price bands.** Each item has a `min_price`/`max_price` set by the owner. Every offer, and every acceptance,
  is checked against it. A merchant talked into "sell it for 0" cannot do it on-chain.
- **NPC limits.** Each NPC has `max_per_trade` and `max_per_day`, plus a balance held inside the contract.
  NPC purchases are checked when the offer is made and again when it is accepted.
- **Restricted NPC keys.** NPC accounts get function-call keys that may only call `make_offer`,
  `cancel_offer`, `accept_offer` and `prune_expired`. Those keys cannot attach NEAR, so they also cannot
  call `mt_transfer` (needs 1 yoctoNEAR) or move NEAR out. Only the owner can withdraw an NPC's balance.
- **Kill switch.** `set_npc_active(npc, false)` stops an NPC and blocks acceptance of its open offers.
- **Bounded storage.** At most 25 open offers per NPC and 32 items; offers expire within 60 minutes.
  `mt_transfer` only sends to NPCs or accounts that already hold items. The contract account pays storage.

## Owner methods
| Method | Notes |
|---|---|
| `new(owner)` | init |
| `add_item(item_id, name, min_price, max_price)` | |
| `set_price_band(item_id, min_price, max_price)` | |
| `register_npc(npc, limits)` | `limits = { max_per_trade, max_per_day }` |
| `set_npc_limits(npc, limits)` / `set_npc_active(npc, active)` | |
| `fund_npc(npc)` *payable* | attached NEAR goes to the NPC's balance |
| `withdraw_npc(npc, amount)` | NEAR back to the owner |
| `mint(to, item_id, amount)` | restock; emits NEP-245 `mt_mint` |

## Trading
| Method | Caller | Notes |
|---|---|---|
| `make_offer(counterparty, item_id, quantity, unit_price, side, ttl_minutes)` → id | NPC | `side`: `"NpcSells"` or `"NpcBuys"` |
| `accept_offer(offer_id)` *payable* | the counterparty | players buying attach ≥ total (excess refunded); NPCs attach nothing |
| `cancel_offer(offer_id)` | offer's NPC or owner | |
| `prune_expired(limit)` | anyone | |
| `mt_transfer(receiver_id, token_id, amount, approval, memo)` | item holder | exactly 1 yoctoNEAR |

## Views
`mt_balance_of`, `mt_batch_balance_of`, `mt_supply`, `get_owner`, `get_items`, `inventory_of(account_id)`,
`get_npc(account_id)`, `get_npcs`, `get_offer(offer_id)`, `get_offers(from_index?, limit?)`.

## Events
Logged as `EVENT_JSON:`. Standard `nep245`: `mt_mint`, `mt_transfer`. Standard `haggletown`: `offer_created`,
`offer_cancelled`, `trade` (`offer_id, buyer, seller, item_id, quantity, unit_price, total`).

## NEP-245 coverage
Implemented: `mt_transfer`, `mt_balance_of`, `mt_batch_balance_of`, `mt_supply`, `mt_mint`/`mt_transfer` events.
Not yet: approvals, `mt_batch_transfer`, `mt_transfer_call`, token metadata.
