// Deterministic pricing and offer policy. The LLM proposes; this decides what is actually posted on-chain.
import { ITEMS } from '../config/world.js';

const YOCTO_PER_MICRO = 10n ** 18n; // prices are rounded to 0.000001 NEAR
const MAX_QTY = 5;

const itemById = Object.fromEntries(ITEMS.map((i) => [i.id, i]));

export const toYocto = (near) => (BigInt(Math.round(Number(near) * 1e6)) * YOCTO_PER_MICRO).toString();
export const toNear = (yocto) => Number(BigInt(yocto) / YOCTO_PER_MICRO) / 1e6;

/**
 * Reference prices (NEAR) for one NPC and one item.
 * Scarcer stock -> higher sell price. NPCs buy at ~60% of their sell price.
 */
export function quote(itemId, stock, startingStock) {
  const item = itemById[itemId];
  const min = Number(item.min);
  const max = Number(item.max);
  const base = min + (max - min) * 0.4;
  const ratio = startingStock ? Math.min(stock / startingStock, 1.5) : 0.5;
  const sell = clamp(base * (1 + 0.5 * (1 - ratio)), min, max);
  const buy = clamp(sell * 0.6, min, max);
  return {
    sell: round(sell),
    buy: round(buy),
    sellFloor: round(Math.max(min, sell * 0.8)), // lowest the NPC will sell for
    buyCeiling: round(Math.min(max, buy * 1.25)), // highest the NPC will pay
    min,
    max,
  };
}

/**
 * Checks and adjusts an LLM-proposed offer. Returns { offer } ready for the contract, or { reason } if refused.
 * proposal: { side: 'sell'|'buy', item_id, quantity, unit_price } (unit_price in NEAR)
 */
export function applyPolicy(proposal, { npc, npcStock, startingStock, playerStock }) {
  if (!proposal) return { reason: null };
  const item = itemById[proposal.item_id];
  if (!item) return { reason: 'unknown item' };
  const side = proposal.side === 'buy' ? 'buy' : 'sell';
  let quantity = Math.max(1, Math.min(MAX_QTY, Math.floor(Number(proposal.quantity) || 1)));
  const q = quote(item.id, npcStock[item.id] || 0, startingStock[item.id] || 0);
  let price = Number(proposal.unit_price);
  if (!Number.isFinite(price) || price <= 0) return { reason: 'no valid price' };

  if (side === 'sell') {
    const have = npcStock[item.id] || 0;
    if (have <= 0) return { reason: `out of ${item.name}` };
    quantity = Math.min(quantity, have);
    price = clamp(price, q.sellFloor, q.max);
  } else {
    const have = playerStock[item.id] || 0;
    if (have <= 0) return { reason: `player has no ${item.name}` };
    quantity = Math.min(quantity, have);
    price = clamp(price, q.min, q.buyCeiling);
    // Respect on-chain limits so the offer will not be rejected.
    const maxPerTrade = toNear(npc.limits.max_per_trade);
    const remainingToday = toNear(npc.limits.max_per_day) - toNear(npc.spent_today);
    const budget = Math.min(maxPerTrade, remainingToday, toNear(npc.balance));
    while (quantity > 1 && quantity * price > budget) quantity -= 1;
    if (quantity * price > budget) return { reason: 'over the merchant\'s spending limit' };
  }
  price = round(price);
  return {
    offer: {
      side: side === 'sell' ? 'NpcSells' : 'NpcBuys',
      itemId: item.id,
      quantity,
      unitPrice: toYocto(price),
      unitPriceNear: price,
    },
  };
}

function clamp(v, lo, hi) {
  return Math.min(hi, Math.max(lo, v));
}
function round(v) {
  return Math.round(v * 1e6) / 1e6;
}
