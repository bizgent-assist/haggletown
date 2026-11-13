// End-to-end check on testnet, signing exactly the way the app will:
//  1. Mira (her function-call key) offers 1 potion to the operator, who accepts and pays.
//  2. Mira tries to sell below the price band  -> contract rejects.
//  3. Mira's key tries mt_transfer             -> rejected (key not allowed / no deposit).
//  4. Mira offers to buy a sword above her per-trade limit -> contract rejects.
//   node scripts/near/smoke-trade.js [--operator you.testnet]
import { Account } from 'near-api-js';
import {
  call, loadAccount, marketId, nearToYocto, operatorId, provider, returnValue, txLink, view, yoctoToNear,
} from './common.js';

const market = marketId();
const player = loadAccount(operatorId());
const npcId = `mira.${player.accountId}`;
const npcKey = JSON.parse(process.env.NPC_KEYS || '{}').mira;
if (!npcKey) throw new Error('NPC_KEYS.mira missing from server/.env; run setup-world.js first');
const mira = new Account(npcId, provider, npcKey);

let failures = 0;
const check = (ok, label) => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}`);
  if (!ok) failures += 1;
};
async function expectReject(label, fn, pattern) {
  try {
    const res = await fn();
    const failure = res?.status?.Failure;
    check(Boolean(failure) && pattern.test(JSON.stringify(failure)), `${label} (rejected on-chain)`);
  } catch (err) {
    check(pattern.test(String(err?.message ?? err)), `${label} (${String(err?.message ?? err).slice(0, 90)})`);
  }
}

// 1. Happy path
const price = nearToYocto('0.02');
const before = BigInt(await view(market, 'mt_balance_of', { account_id: player.accountId, token_id: 'potion' }));
const offerRes = await call(mira, market, 'make_offer', {
  counterparty: player.accountId, item_id: 'potion', quantity: 1, unit_price: price.toString(), side: 'NpcSells', ttl_minutes: 10,
}, { gas: '15' });
const offerId = returnValue(offerRes);
console.log(`Mira offered potion #${offerId} at 0.02 NEAR: ${txLink(offerRes)}`);
const acceptRes = await call(player, market, 'accept_offer', { offer_id: offerId }, { deposit: price });
console.log(`Player accepted and paid: ${txLink(acceptRes)}`);
const after = BigInt(await view(market, 'mt_balance_of', { account_id: player.accountId, token_id: 'potion' }));
check(after === before + 1n, `player potion balance ${before} -> ${after}`);
const miraState = await view(market, 'get_npc', { account_id: npcId });
console.log(`      Mira trading balance now ${yoctoToNear(miraState.balance)} NEAR`);

// 2. Price band
await expectReject('sell below price band', () => call(mira, market, 'make_offer', {
  counterparty: player.accountId, item_id: 'potion', quantity: 1, unit_price: '1', side: 'NpcSells', ttl_minutes: 10,
}, { gas: '15' }), /outside the item's allowed band/);

// 3. Restricted key
await expectReject('NPC key calling mt_transfer', () => call(mira, market, 'mt_transfer', {
  receiver_id: player.accountId, token_id: 'potion', amount: '1',
}, { gas: '15', deposit: 1n }), /MethodNameMismatch|DepositWithFunctionCall|not allowed|deposit|yocto/i);

// 4. Per-trade limit (sword max 0.3 > Mira's 0.2 per trade)
await expectReject('NPC buy above per-trade limit', () => call(mira, market, 'make_offer', {
  counterparty: player.accountId, item_id: 'sword', quantity: 1, unit_price: nearToYocto('0.3').toString(), side: 'NpcBuys', ttl_minutes: 10,
}, { gas: '15' }), /per-trade limit/);

console.log(failures ? `\n${failures} check(s) failed` : '\nAll checks passed');
process.exit(failures ? 1 : 0);
