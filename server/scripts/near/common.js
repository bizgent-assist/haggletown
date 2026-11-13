// Operator tooling for testnet. Runs on a developer machine, never on the server.
// The operator's full-access key is read from the NEAR CLI credential store
// (~/.near-credentials/testnet/<account>.json). Keys are never printed.
import 'dotenv/config';
import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { homedir } from 'node:os';
import { Account, JsonRpcProvider, nearToYocto, teraToGas } from 'near-api-js';

export const NETWORK = 'testnet';
export const RPC = process.env.NEAR_RPC_URL || 'https://test.rpc.fastnear.com';
export const EXPLORER = process.env.NEAR_EXPLORER_URL || 'https://testnet.nearblocks.io';
export const provider = new JsonRpcProvider({ url: RPC });
export { nearToYocto, teraToGas };

const CRED_DIR = join(homedir(), '.near-credentials', NETWORK);

export function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : fallback;
}

export function operatorId() {
  const id = arg('operator', process.env.OPERATOR_ACCOUNT_ID);
  if (!id) throw new Error('Pass --operator <you>.testnet or set OPERATOR_ACCOUNT_ID in server/.env');
  if (!id.endsWith('.testnet')) throw new Error('Operator must be a .testnet account (testnet only)');
  return id;
}

export function marketId() {
  return process.env.MARKET_CONTRACT_ID || `market.${operatorId()}`;
}

/** Account signed with the key stored in the NEAR CLI credential store. */
export function loadAccount(accountId) {
  const file = join(CRED_DIR, `${accountId}.json`);
  if (!existsSync(file)) throw new Error(`No credentials for ${accountId} in ${CRED_DIR}`);
  const { private_key: key } = JSON.parse(readFileSync(file, 'utf8'));
  return new Account(accountId, provider, key);
}

export function readCredential(accountId) {
  const file = join(CRED_DIR, `${accountId}.json`);
  return existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : null;
}

export function saveCredential(accountId, keyPair) {
  mkdirSync(CRED_DIR, { recursive: true });
  const file = join(CRED_DIR, `${accountId}.json`);
  writeFileSync(
    file,
    JSON.stringify({
      account_id: accountId,
      public_key: keyPair.getPublicKey().toString(),
      private_key: keyPair.toString(),
    }),
    { mode: 0o600 },
  );
  return file;
}

export async function accountExists(accountId) {
  const res = await fetch(RPC, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'query',
      params: { request_type: 'view_account', finality: 'final', account_id: accountId },
    }),
  });
  const body = await res.json();
  return Boolean(body.result);
}

export const view = (contractId, method, args = {}) =>
  provider.callFunction({ contractId, method, args, finality: 'final' });

export function call(account, contractId, methodName, args = {}, { deposit = 0n, gas = '30' } = {}) {
  return account.callFunctionRaw({ contractId, methodName, args, deposit: BigInt(deposit), gas: teraToGas(gas) });
}

/** JSON return value of a function call outcome, if any. */
export function returnValue(res) {
  const b64 = res?.status?.SuccessValue;
  return b64 ? JSON.parse(Buffer.from(b64, 'base64').toString()) : undefined;
}

export const txLink = (res) => `${EXPLORER}/txns/${res.transaction.hash}`;

export const yoctoToNear = (y) => (Number(BigInt(y) / 10n ** 18n) / 1e6).toString();

export function upsertEnv(fileName, vars) {
  const file = resolve(process.cwd(), fileName);
  let text = existsSync(file) ? readFileSync(file, 'utf8') : '';
  for (const [k, v] of Object.entries(vars)) {
    const re = new RegExp(`^${k}=.*$`, 'm');
    text = re.test(text) ? text.replace(re, () => `${k}=${v}`) : `${text.replace(/\s*$/, '')}\n${k}=${v}\n`;
  }
  writeFileSync(file, text.replace(/^\n/, ''));
  return file;
}
