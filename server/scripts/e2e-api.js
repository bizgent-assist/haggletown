// End-to-end check of the HTTP API against testnet, acting as a player with a local key
// (~/.near-credentials/testnet/<player>.json). Signs in with NEP-413, haggles until a merchant posts an
// offer, accepts it on-chain, confirms it with the API, and checks the market tick lock.
//   node scripts/e2e-api.js --player you.testnet [--api http://localhost:4100/api/v1] [--npc tess]
import { KeyPair } from 'near-api-js';
import { arg, call, loadAccount, readCredential, txLink } from './near/common.js';
import { payloadHash } from '../src/services/nep413.js';

const API = arg('api', 'http://localhost:4100/api/v1');
const playerId = arg('player', process.env.OPERATOR_ACCOUNT_ID);
const npc = arg('npc', 'tess');
const market = process.env.MARKET_CONTRACT_ID;
let failures = 0;
const check = (ok, label) => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}`);
  if (!ok) failures += 1;
};
async function http(method, path, body, token) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, body: await res.json().catch(() => ({})) };
}

// 1. Protected routes need a session
check((await http('POST', `/npcs/${npc}/haggle`, { message: 'hi' })).status === 401, 'haggle without sign-in is refused (401)');

// 2. NEP-413 sign-in
const cred = readCredential(playerId);
const kp = KeyPair.fromString(cred.private_key);
const challenge = (await http('GET', '/auth/challenge')).body;
const { signature } = kp.sign(payloadHash({ message: challenge.message, nonce: Buffer.from(challenge.nonce, 'base64'), recipient: challenge.recipient }));
const signIn = await http('POST', '/auth/verify', {
  accountId: playerId, publicKey: kp.getPublicKey().toString(), signature: Buffer.from(signature).toString('base64'), nonce: challenge.nonce,
});
check(signIn.status === 200 && Boolean(signIn.body.token), 'NEP-413 sign-in returns a session');
const replay = await http('POST', '/auth/verify', {
  accountId: playerId, publicKey: kp.getPublicKey().toString(), signature: Buffer.from(signature).toString('base64'), nonce: challenge.nonce,
});
check(replay.status === 400, 'replaying the same signed challenge is refused');
const token = signIn.body.token;

// 3. Haggle until an offer is posted
let offer;
for (const line of [
  'Hello Tess! I would like to buy one silver carp. What is your price?',
  'That sounds fair. Please put one silver carp on the table for me at your price.',
  'Yes, I accept. Please post the offer for one silver carp now.',
]) {
  const r = await http('POST', `/npcs/${npc}/haggle`, { message: line }, token);
  console.log(`      ${npc}: ${r.body.reply?.text ?? JSON.stringify(r.body)}`);
  if (r.body.reply?.note) console.log(`      note: ${r.body.reply.note}`);
  offer = r.body.reply?.offer;
  if (offer) break;
}
check(Boolean(offer), `merchant posted an on-chain offer${offer ? ` (#${offer.offerId}: ${offer.quantity} ${offer.itemId} @ ${offer.unitPriceNear})` : ''}`);

// 4. Accept on-chain, confirm via API
if (offer) {
  const player = loadAccount(playerId);
  const deposit = offer.side === 'NpcSells' ? BigInt(offer.unitPrice) * BigInt(offer.quantity) : 0n;
  const res = await call(player, market, 'accept_offer', { offer_id: offer.offerId }, { deposit });
  console.log(`      accepted: ${txLink(res)}`);
  const confirm = await http('POST', '/trades/confirm', { txHash: res.transaction.hash }, token);
  check(confirm.status === 201 && confirm.body.trade?.offerId === offer.offerId, 'API verified the trade on-chain and recorded it');
  const convo = await http('GET', `/npcs/${npc}/conversation`, null, token);
  check(convo.body.messages?.some((m) => m.offer?.offerId === offer.offerId && m.offer.status === 'accepted'), 'chat shows the offer as accepted');
}

// 5. Claiming someone else's transaction is refused (this one was signed by the merchant Grob)
const forged = await http('POST', '/trades/confirm', { txHash: '2jDfqc47FaDCttBZLQ7Sg1TTDphjGva7kVJ1Z1uKGCM3' }, token);
check(forged.status === 400, `confirming another account's transaction is refused (status ${forged.status})`);

// 6. Market tick lock
const t1 = await http('POST', '/market/tick');
const t2 = await http('POST', '/market/tick');
check(t2.body.ran === false, `second tick within 2 minutes is skipped (first ran=${t1.body.ran})`);

console.log(failures ? `\n${failures} check(s) failed` : '\nAll checks passed');
process.exit(failures ? 1 : 0);
