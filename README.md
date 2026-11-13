# Haggletown

A browser market town where every merchant is an AI agent with its own NEAR wallet. Haggle with them in
chat, buy and sell items that live on-chain, and watch prices move as the merchants trade with each other,
always inside spending limits the smart contract enforces.

Built for the **NEAR Hackathon 2026**, track **Games With Real Economies**. Testnet only, unaudited.

> Status: work in progress. See [docs/SPEC.md](docs/SPEC.md) for the build plan.

**Live on testnet:** contract [`market.haggletown-2026.testnet`](https://testnet.nearblocks.io/address/market.haggletown-2026.testnet)
with four AI merchants. See [docs/TESTNET.md](docs/TESTNET.md) for accounts, verified transactions and how to
redeploy with your own account, and [docs/CONTRACT.md](docs/CONTRACT.md) for the contract interface.

## Stack
| Part | Tech |
|---|---|
| Client | React 19, Vite, React Router, Tailwind CSS, `@hot-labs/near-connect` |
| Server | Node.js, Express 5, MongoDB (Mongoose) |
| AI | NEAR AI Cloud (OpenAI-compatible API) |
| Email | Brevo transactional email |
| Contract | Rust, near-sdk 5.29.1 |

## Run locally
Requires Node 20+, a MongoDB connection string and (for the contract) Rust + `cargo-near`.

```bash
cd server
cp .env.example .env   # fill in MONGODB_URI, JWT_SECRET, AI_API_KEY, BREVO_* ...
npm install
npm run dev            # http://localhost:4100/api/v1/health
```

```bash
cd client
cp .env.example .env
npm install
npm run dev            # http://localhost:5174
```

```bash
cd contracts/market
cargo near build
```

## Hackathon disclosures
- **Other project:** this team also submitted **Bizgent** (https://bizgent.vercel.app/), an AI finance
  agent for small businesses. The two projects are independent and share no code.
- **Pre-hackathon code:** none. All code was written during the hackathon (from 2026-11-12).
- **External libraries and services:** listed in the stack table above and in each `package.json` / `Cargo.toml`.

## License
MIT, see [LICENSE](LICENSE).
