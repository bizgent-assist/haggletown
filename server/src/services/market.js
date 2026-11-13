// Live market state read from the chain, shaped for the API.
import { ITEMS, NPCS } from '../config/world.js';
import { npcAccountId, view } from './near.js';
import { quote, toNear } from './pricing.js';

const itemName = Object.fromEntries(ITEMS.map((i) => [i.id, i.name]));

export const findNpc = (slug) => NPCS.find((n) => n.slug === slug);

export async function inventoryOf(accountId) {
  const inv = await view('inventory_of', { account_id: accountId });
  return Object.fromEntries(Object.entries(inv).map(([k, v]) => [k, Number(v)]));
}

/** One NPC's stall: on-chain state, stock and current reference prices. */
export async function stallOf(npc) {
  const accountId = npcAccountId(npc.slug);
  const [state, stock] = await Promise.all([view('get_npc', { account_id: accountId }), inventoryOf(accountId)]);
  // Items the NPC trades: what it started with plus anything it now holds.
  const itemIds = [...new Set([...Object.keys(npc.stock), ...Object.keys(stock)])];
  const items = itemIds.map((id) => {
    const q = quote(id, stock[id] || 0, npc.stock[id] || 0);
    return { itemId: id, name: itemName[id], quantity: stock[id] || 0, sellPrice: q.sell, buyPrice: q.buy, ...q };
  });
  return {
    slug: npc.slug,
    name: npc.name,
    trade: npc.trade,
    blurb: npc.blurb,
    accountId,
    state,
    stock,
    items,
    balanceNear: state ? toNear(state.balance) : 0,
    active: state?.active ?? false,
  };
}

export function publicStall(stall) {
  const { state, stock, ...rest } = stall;
  return {
    ...rest,
    limits: state
      ? { maxPerTrade: toNear(state.limits.max_per_trade), maxPerDay: toNear(state.limits.max_per_day), spentToday: toNear(state.spent_today) }
      : null,
    items: stall.items.map(({ itemId, name, quantity, sellPrice, buyPrice }) => ({ itemId, name, quantity, sellPrice, buyPrice })),
  };
}

export { itemName };
