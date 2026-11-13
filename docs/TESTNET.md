# Testnet deployment

Testnet NEAR has no real value.

## Live deployment (2026-11-13)
| What | Account |
|---|---|
| Operator / contract owner | `haggletown-2026.testnet` |
| Market contract | [`market.haggletown-2026.testnet`](https://testnet.nearblocks.io/address/market.haggletown-2026.testnet) |
| Merchants (NPCs) | `mira.`, `grob.`, `tess.`, `oren.haggletown-2026.testnet` |

Each merchant account has **one key only**: a function-call key for the market contract limited to
`make_offer`, `cancel_offer`, `accept_offer`, `prune_expired`, with a 0.5 NEAR gas allowance. No full-access key
exists for any merchant. Each merchant starts with 0.4 NEAR trading balance and limits of 0.2 NEAR per trade
and 1 NEAR per day. Items and price bands are defined in [server/src/config/world.js](../server/src/config/world.js).

### Verified on-chain
`npm run near:smoke` on 2026-11-13, all checks passed:
- Mira offered a potion at 0.02 NEAR ([tx](https://testnet.nearblocks.io/txns/BR2Ehy2QtT1qAacB9SRekByXYPZraYz97MXwujUHwt9t)),
  the player accepted and paid ([tx](https://testnet.nearblocks.io/txns/134NzFaL26j8vytDYB4eWytg2VghwUvf6zeYxxh9mX8W)).
- Offer below the price band: rejected by the contract.
- Merchant key calling `mt_transfer`: rejected by the protocol (function-call keys cannot attach a deposit).
- Merchant buying above its per-trade limit: rejected by the contract.

## Reproduce with your own account
Requirements: Node 20+, `gh` (to fetch the wasm), and NEAR CLI for a faucet account.

```bash
near create-account <you>.testnet --useFaucet --networkId testnet   # 10 testnet NEAR, key saved to ~/.near-credentials
gh run download --name haggletown-market-wasm -D contracts/market/target/near
cd server && npm install
npm run near:deploy -- --operator <you>.testnet   # creates market.<you>.testnet, deploys, initialises
npm run near:setup                                # items, merchant accounts + restricted keys, funding, stock
npm run near:status                               # print the market
npm run near:smoke                                # live trade + three rejection checks
```
Budget: about 3.5 NEAR for the contract account and 1 NEAR per merchant. The scripts are safe to re-run and resume
after a network error. `deploy` and `setup` write `OPERATOR_ACCOUNT_ID`, `MARKET_CONTRACT_ID` and `NPC_KEYS` into
`server/.env` and `VITE_MARKET_CONTRACT_ID` into `client/.env` (both git-ignored).
