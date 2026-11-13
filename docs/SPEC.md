# Haggletown spec

Track: **Games With Real Economies** (`games`). Deadline: 2026-11-14 23:59 UTC.

## One-line pitch
A browser market town where AI merchants own NEAR wallets, hold real on-chain stock, haggle with players
in chat, and trade with each other inside spending limits the contract enforces.

## Must-have for the demo (in build order)
1. **Market contract** (`contracts/market`, Rust, near-sdk 5.29.1): item balances, NPC registry with
   per-trade and daily limits, `player_buy`, `player_sell`, `npc_trade`, trade events.
2. **NPC accounts**: one sub-account per merchant (e.g. `mira.market.<you>.testnet`), each with a
   function-call key that can only call `npc_trade`.
3. **Haggle API** (`POST /api/v1/npcs/:slug/haggle`): the LLM (NEAR AI Cloud) plays the merchant and
   returns `{ reply, offer: { itemId, quantity, unitPrice } | null }`. A deterministic check clamps the
   offer to the NPC's floor price and limits before anything is signed.
4. **Accept offer**: the player signs `player_buy` / `player_sell` from their wallet (near-connect).
   The server reads the transaction outcome before marking the trade `verified`.
5. **Market tick** (every `MARKET_TICK_SECONDS`): NPCs restock, trade with each other and update
   prices from supply and cash. This keeps the economy moving with no players present.
6. **Ledger page**: all verified trades with explorer links; price chart per item.
7. **Email (Brevo)**: optional notice when a merchant sends a counter-offer or a price alert fires.

## Nice to have
- NEP-245 `mt_*` methods so items work in other wallets/apps.
- NEAR Intents for paying in other tokens.
- Social login for players.

## Data
- MongoDB: `Player`, `Npc` (personality, mood, price memory), `Trade` (status pending/verified/failed).
- On-chain (source of truth): item balances, NPC limits, NEAR balances.

## Hackathon rules to satisfy
- Public repo + MIT LICENSE, README that lets a judge reproduce it.
- README names the other project (Bizgent) as required for multiple submissions.
- Public X post tagging @NEARProtocol with #NEARHackathon and a demo video.
