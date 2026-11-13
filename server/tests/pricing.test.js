import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyPolicy, quote, toYocto } from '../src/services/pricing.js';

const npc = {
  limits: { max_per_trade: toYocto(0.2), max_per_day: toYocto(1) },
  spent_today: '0',
  balance: toYocto(0.4),
};
const ctx = { npc, npcStock: { potion: 10 }, startingStock: { potion: 20 }, playerStock: { herb: 3 } };

test('scarcer stock raises the price', () => {
  assert.ok(quote('potion', 2, 20).sell > quote('potion', 20, 20).sell);
});

test('sell offers below the floor are raised to the floor', () => {
  const { offer } = applyPolicy({ side: 'sell', item_id: 'potion', quantity: 1, unit_price: '0.000001' }, ctx);
  assert.equal(offer.unitPriceNear, quote('potion', 10, 20).sellFloor);
  assert.equal(offer.side, 'NpcSells');
});

test('cannot sell more than the merchant holds', () => {
  const { offer } = applyPolicy({ side: 'sell', item_id: 'potion', quantity: 50, unit_price: '0.05' }, { ...ctx, npcStock: { potion: 2 } });
  assert.equal(offer.quantity, 2);
});

test('buy offers are capped at the buy ceiling and need the player to hold the item', () => {
  const { offer } = applyPolicy({ side: 'buy', item_id: 'herb', quantity: 1, unit_price: '5' }, ctx);
  assert.equal(offer.unitPriceNear, quote('herb', 0, 0).buyCeiling);
  assert.equal(applyPolicy({ side: 'buy', item_id: 'sword', quantity: 1, unit_price: '0.1' }, ctx).offer, undefined);
});

test('unknown items and bad prices are refused', () => {
  assert.ok(applyPolicy({ side: 'sell', item_id: 'dragon', quantity: 1, unit_price: '1' }, ctx).reason);
  assert.ok(applyPolicy({ side: 'sell', item_id: 'potion', quantity: 1, unit_price: 'free' }, ctx).reason);
});
