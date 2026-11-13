// Prints the market's items, NPCs (limits, balances, stock) and open offers.
//   node scripts/near/status.js [--operator you.testnet]
import { marketId, view, yoctoToNear } from './common.js';

const market = marketId();
console.log(`Market: ${market}  owner: ${await view(market, 'get_owner')}\n`);

for (const [id, item] of await view(market, 'get_items')) {
  console.log(`item ${id.padEnd(9)} ${yoctoToNear(item.min_price)}-${yoctoToNear(item.max_price)} NEAR  supply ${item.total_supply}`);
}
console.log();
for (const npc of await view(market, 'get_npcs')) {
  const inv = await view(market, 'inventory_of', { account_id: npc.account_id });
  console.log(
    `${npc.account_id}  active=${npc.active}  balance=${yoctoToNear(npc.balance)} NEAR  spent today=${yoctoToNear(npc.spent_today)}`
      + `  limits=${yoctoToNear(npc.limits.max_per_trade)}/trade ${yoctoToNear(npc.limits.max_per_day)}/day  offers=${npc.open_offers}`,
  );
  console.log(`  stock: ${Object.entries(inv).map(([k, v]) => `${k}=${v}`).join(' ') || '(none)'}`);
}
const offers = await view(market, 'get_offers', {});
console.log(`\nOpen offers: ${offers.length}`);
for (const o of offers) {
  console.log(`  #${o.id} ${o.npc} ${o.side} ${o.quantity} ${o.item_id} @ ${yoctoToNear(o.unit_price)} NEAR -> ${o.counterparty}`);
}
