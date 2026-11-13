// Creates market.<operator>, deploys the contract wasm and initialises it with the operator as owner.
// Re-running redeploys the code only (state is kept).
//   node scripts/near/deploy.js --operator you.testnet [--fund 3.5]
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { KeyPair } from 'near-api-js';
import {
  accountExists, arg, call, loadAccount, nearToYocto, operatorId, saveCredential, txLink, upsertEnv, view,
} from './common.js';

const op = loadAccount(operatorId());
const marketId = `market.${op.accountId}`;
const wasm = resolve(arg('wasm', '../contracts/market/target/near/haggletown_market.wasm'));
const code = readFileSync(wasm);

const existed = await accountExists(marketId);
let market;
if (existed) {
  market = loadAccount(marketId);
  console.log(`${marketId} exists; redeploying code.`);
} else {
  const kp = KeyPair.fromRandom('ed25519');
  const res = await op.createSubAccount({
    accountOrPrefix: 'market',
    publicKey: kp.getPublicKey().toString(),
    nearToTransfer: nearToYocto(arg('fund', '3.5')),
  });
  console.log(`Created ${marketId}: ${txLink(res)}`);
  console.log(`Market full-access key saved to ${saveCredential(marketId, kp)} (for upgrades only).`);
  market = loadAccount(marketId);
}

const dep = await market.deployContract(new Uint8Array(code));
console.log(`Deployed ${code.length} bytes: ${txLink(dep)}`);

if (!existed) {
  const init = await call(market, marketId, 'new', { owner: op.accountId });
  console.log(`Initialised with owner ${op.accountId}: ${txLink(init)}`);
}
console.log('Owner on-chain:', await view(marketId, 'get_owner'));

upsertEnv('.env', { OPERATOR_ACCOUNT_ID: op.accountId, MARKET_CONTRACT_ID: marketId });
upsertEnv('../client/.env', { VITE_MARKET_CONTRACT_ID: marketId });
console.log(`Wrote MARKET_CONTRACT_ID=${marketId} to server/.env and client/.env`);
