// Configures the deployed market from src/config/world.js. Safe to re-run: it only adds what is missing.
// - adds items with their price bands
// - creates one account per NPC (<slug>.<operator>) whose ONLY key is a function-call key
//   limited to the market's offer methods, then registers, funds and stocks the NPC
//   node scripts/near/setup-world.js --operator you.testnet
import { KeyPair } from 'near-api-js';
import { ITEMS, NPCS, NPC_FUNDING, NPC_KEY_METHODS } from '../../src/config/world.js';
import {
  RPC, accountExists, call, loadAccount, marketId, nearToYocto, operatorId, readCredential, saveCredential, txLink,
  upsertEnv, view,
} from './common.js';

const op = loadAccount(operatorId());
const market = marketId();
const npcKeys = JSON.parse(process.env.NPC_KEYS || '{}');

// Items
const existingItems = new Set((await view(market, 'get_items')).map(([id]) => id));
for (const item of ITEMS) {
  if (existingItems.has(item.id)) continue;
  const res = await call(op, market, 'add_item', {
    item_id: item.id, name: item.name, min_price: nearToYocto(item.min).toString(), max_price: nearToYocto(item.max).toString(),
  });
  console.log(`Item ${item.id} (${item.min}-${item.max} NEAR): ${txLink(res)}`);
}

for (const npc of NPCS) {
  const npcId = `${npc.slug}.${op.accountId}`;

  // Account with a function-call key only
  if (!(await accountExists(npcId))) {
    const temp = KeyPair.fromRandom('ed25519');
    saveCredential(npcId, temp); // saved first so an interrupted run can resume
    const created = await op.createSubAccount({
      accountOrPrefix: npc.slug, publicKey: temp.getPublicKey().toString(), nearToTransfer: nearToYocto(NPC_FUNDING.accountGas),
    });
    console.log(`Created ${npcId}: ${txLink(created)}`);
  }
  if (!npcKeys[npc.slug]) {
    const saved = readCredential(npcId);
    if (!saved) throw new Error(`${npcId} exists but no key is stored for it`);
    if ((await keyPermission(npcId, saved.public_key)) === 'FullAccess') {
      // Swap the temporary full-access key for a restricted function-call key.
      const tempAccount = loadAccount(npcId);
      const fc = KeyPair.fromRandom('ed25519');
      const added = await tempAccount.addFunctionCallAccessKey({
        publicKey: fc.getPublicKey().toString(), contractId: market, methodNames: NPC_KEY_METHODS,
        allowance: nearToYocto(NPC_FUNDING.keyAllowance),
      });
      console.log(`  function-call key (${NPC_KEY_METHODS.join(', ')}): ${txLink(added)}`);
      saveCredential(npcId, fc);
      const removed = await tempAccount.deleteKey(saved.public_key);
      console.log(`  removed temporary full-access key: ${txLink(removed)}`);
      npcKeys[npc.slug] = fc.toString();
    } else {
      npcKeys[npc.slug] = saved.private_key;
    }
    upsertEnv('.env', { NPC_KEYS: JSON.stringify(npcKeys) });
  }

  // Registration, trading balance and stock
  let state = await view(market, 'get_npc', { account_id: npcId });
  if (!state) {
    const res = await call(op, market, 'register_npc', {
      npc: npcId,
      limits: { max_per_trade: nearToYocto(npc.limits.maxPerTrade).toString(), max_per_day: nearToYocto(npc.limits.maxPerDay).toString() },
    });
    console.log(`  registered ${npc.name} (${npc.limits.maxPerTrade}/trade, ${npc.limits.maxPerDay}/day): ${txLink(res)}`);
    state = await view(market, 'get_npc', { account_id: npcId });
  }
  const target = nearToYocto(NPC_FUNDING.tradingBalance);
  if (BigInt(state.balance) < target) {
    const res = await call(op, market, 'fund_npc', { npc: npcId }, { deposit: target - BigInt(state.balance) });
    console.log(`  trading balance topped up to ${NPC_FUNDING.tradingBalance} NEAR: ${txLink(res)}`);
  }
  for (const [itemId, qty] of Object.entries(npc.stock)) {
    const have = BigInt(await view(market, 'mt_balance_of', { account_id: npcId, token_id: itemId }));
    if (have >= BigInt(qty)) continue;
    const res = await call(op, market, 'mint', { to: npcId, item_id: itemId, amount: (BigInt(qty) - have).toString() });
    console.log(`  stocked ${qty} ${itemId}: ${txLink(res)}`);
  }
}

upsertEnv('.env', { NPC_KEYS: JSON.stringify(npcKeys) });
console.log('\nNPC function-call keys written to server/.env as NPC_KEYS (git-ignored; never printed).');

async function keyPermission(accountId, publicKey) {
  const res = await fetch(RPC, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0', id: 1, method: 'query',
      params: { request_type: 'view_access_key', finality: 'final', account_id: accountId, public_key: publicKey },
    }),
  });
  const { result } = await res.json();
  if (!result) return null;
  return result.permission === 'FullAccess' ? 'FullAccess' : 'FunctionCall';
}
