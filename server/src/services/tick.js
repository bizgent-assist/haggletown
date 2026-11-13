// The market tick: keeps the economy moving with no players around.
// Each tick, at most one merchant that is short of something it wants buys it from another merchant.
// The seller posts the offer and the buyer accepts it, each with its own restricted key, so every
// NPC-to-NPC trade is a real pair of NEAR transactions checked by the contract's bands and limits.
import { env } from '../config/env.js';
import { NPCS } from '../config/world.js';
import { Trade } from '../models/Trade.js';
import { stallOf } from './market.js';
import { acceptOfferAsNpc, cancelOfferAsNpc, makeOffer, npcAccountId, pruneExpiredAsNpc } from './near.js';
import { quote, toNear, toYocto } from './pricing.js';

const MAX_QTY = 2;
const WHOLESALE = 0.9; // merchants sell to each other a little below their shop price

function shuffle(list, rng) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Picks one feasible deal, or null. Pure: takes stalls ({ npc, stock, state }) and an rng.
 * Returns { seller, buyer, itemId, quantity, unitPriceNear }.
 */
export function planDeal(stalls, rng = Math.random) {
  for (const buyer of shuffle(stalls, rng)) {
    if (!buyer.state?.active) continue;
    const budget = Math.min(
      toNear(buyer.state.limits.max_per_trade),
      toNear(buyer.state.limits.max_per_day) - toNear(buyer.state.spent_today),
      toNear(buyer.state.balance),
    );
    for (const [itemId, target] of shuffle(Object.entries(buyer.npc.wants || {}), rng)) {
      const short = target - (buyer.stock[itemId] || 0);
      if (short <= 0) continue;
      for (const seller of shuffle(stalls, rng)) {
        if (seller === buyer || !seller.state?.active) continue;
        const spare = (seller.stock[itemId] || 0) - (seller.npc.wants?.[itemId] || 0);
        if (spare <= 0) continue;
        const q = quote(itemId, seller.stock[itemId], seller.npc.stock[itemId] || 0);
        const unitPriceNear = Math.round(Math.max(q.min, q.sell * WHOLESALE) * 1e6) / 1e6;
        let quantity = Math.min(short, spare, MAX_QTY);
        while (quantity > 0 && quantity * unitPriceNear > budget) quantity -= 1;
        if (quantity > 0) return { seller: seller.npc, buyer: buyer.npc, itemId, quantity, unitPriceNear };
      }
    }
  }
  return null;
}

let running = false;
let tickCount = 0;

/** Runs one tick. Returns a summary of what happened. */
export async function runTick() {
  if (running) return { skipped: 'previous tick still running' };
  running = true;
  tickCount += 1;
  try {
    const stalls = await Promise.all(NPCS.map(async (npc) => ({ npc, ...(await stallOf(npc)) })));
    if (tickCount % 10 === 1) {
      const withOffers = stalls.find((s) => s.state?.open_offers > 0 && s.state.active);
      if (withOffers) await pruneExpiredAsNpc(withOffers.npc.slug).catch(() => {});
    }
    const deal = planDeal(stalls);
    if (!deal) return { deal: null };

    const unitPrice = toYocto(deal.unitPriceNear);
    const { offerId, txHash: offerTx } = await makeOffer(deal.seller.slug, {
      counterparty: npcAccountId(deal.buyer.slug),
      itemId: deal.itemId,
      quantity: deal.quantity,
      unitPrice,
      side: 'NpcSells',
      ttlMinutes: 5,
    });
    let acceptTx;
    try {
      ({ txHash: acceptTx } = await acceptOfferAsNpc(deal.buyer.slug, offerId));
    } catch (err) {
      await cancelOfferAsNpc(deal.seller.slug, offerId).catch(() => {});
      throw err;
    }
    const trade = await Trade.create({
      kind: 'npc_to_npc',
      offerId,
      buyer: npcAccountId(deal.buyer.slug),
      seller: npcAccountId(deal.seller.slug),
      itemId: deal.itemId,
      quantity: deal.quantity,
      unitPrice,
      total: (BigInt(unitPrice) * BigInt(deal.quantity)).toString(),
      txHash: acceptTx,
    });
    console.log(
      `[tick] ${deal.buyer.name} bought ${deal.quantity} ${deal.itemId} from ${deal.seller.name} @ ${deal.unitPriceNear} NEAR (offer ${offerTx}, accept ${acceptTx})`,
    );
    return { deal: { ...deal, seller: deal.seller.slug, buyer: deal.buyer.slug }, offerTx, acceptTx, tradeId: trade._id };
  } finally {
    running = false;
  }
}

export function startMarketTick() {
  if (!env.marketTickEnabled) {
    console.log('[tick] market tick disabled (MARKET_TICK_ENABLED=false)');
    return null;
  }
  const ms = env.marketTickSeconds * 1000;
  console.log(`[tick] market tick every ${env.marketTickSeconds}s`);
  return setInterval(() => {
    runTick().catch((err) => console.warn('[tick] failed:', err.message));
  }, ms);
}
