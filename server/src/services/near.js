// All chain access for the API: views, NPC-signed offers, and transaction verification.
import { Account, JsonRpcProvider, teraToGas } from 'near-api-js';
import { env } from '../config/env.js';

export const provider = new JsonRpcProvider({ url: env.near.rpcUrl });

export function marketId() {
  if (!env.near.marketContractId) throw Object.assign(new Error('MARKET_CONTRACT_ID is not set'), { status: 503 });
  return env.near.marketContractId;
}

export const npcAccountId = (slug) => `${slug}.${env.near.operatorAccountId}`;

export const view = (method, args = {}) =>
  provider.callFunction({ contractId: marketId(), method, args, finality: 'optimistic' });

export async function rpc(method, params) {
  const res = await fetch(env.near.rpcUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  });
  const body = await res.json();
  if (body.error) throw Object.assign(new Error(body.error.cause?.name || body.error.message), { rpc: body.error });
  return body.result;
}

function npcSigner(slug) {
  const key = env.near.npcKeys[slug];
  if (!key) throw Object.assign(new Error(`No key configured for NPC ${slug}`), { status: 503 });
  return new Account(npcAccountId(slug), provider, key);
}

function failureMessage(failure) {
  const text = JSON.stringify(failure);
  const m = /Smart contract panicked: ([^"\\]+)/.exec(text);
  return m ? m[1] : text.slice(0, 200);
}

async function npcCall(slug, methodName, args) {
  const res = await npcSigner(slug).callFunctionRaw({
    contractId: marketId(), methodName, args, gas: teraToGas('15'), deposit: 0n,
  });
  if (res.status?.Failure) throw Object.assign(new Error(failureMessage(res.status.Failure)), { status: 422 });
  const b64 = res.status?.SuccessValue;
  return { value: b64 ? JSON.parse(Buffer.from(b64, 'base64').toString()) : undefined, txHash: res.transaction.hash };
}

/** NPC posts an offer on-chain. Returns { offerId, txHash }. */
export async function makeOffer(slug, { counterparty, itemId, quantity, unitPrice, side, ttlMinutes = 10 }) {
  const npc = await view('get_npc', { account_id: npcAccountId(slug) });
  if (npc && npc.open_offers >= 20) await npcCall(slug, 'prune_expired', { limit: 25 }).catch(() => {});
  const { value, txHash } = await npcCall(slug, 'make_offer', {
    counterparty, item_id: itemId, quantity, unit_price: unitPrice, side, ttl_minutes: ttlMinutes,
  });
  return { offerId: value, txHash };
}

/**
 * Verifies that `txHash` is a successful accept_offer by `accountId` on the market,
 * and returns the trade from its `haggletown` trade event.
 */
export async function verifyAcceptTx(txHash, accountId) {
  const result = await rpc('tx', { tx_hash: txHash, sender_account_id: accountId, wait_until: 'EXECUTED_OPTIMISTIC' });
  const { transaction } = result;
  const call = transaction.actions?.[0]?.FunctionCall;
  if (transaction.signer_id !== accountId) throw Object.assign(new Error('Signer mismatch'), { status: 400 });
  if (transaction.receiver_id !== marketId() || call?.method_name !== 'accept_offer') {
    throw Object.assign(new Error('Not an accept_offer transaction on the market'), { status: 400 });
  }
  if (result.status?.Failure) throw Object.assign(new Error(failureMessage(result.status.Failure)), { status: 422 });
  for (const outcome of result.receipts_outcome) {
    for (const log of outcome.outcome.logs) {
      if (!log.startsWith('EVENT_JSON:')) continue;
      const event = JSON.parse(log.slice('EVENT_JSON:'.length));
      if (event.standard === 'haggletown' && event.event === 'trade') return event.data[0];
    }
  }
  throw Object.assign(new Error('No trade event in transaction'), { status: 422 });
}
