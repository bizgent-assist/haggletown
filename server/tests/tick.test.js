import { test } from 'node:test';
import assert from 'node:assert/strict';
import { planDeal } from '../src/services/tick.js';
import { toYocto } from '../src/services/pricing.js';

const state = (balance = 0.4, spent = 0) => ({
  active: true,
  balance: toYocto(balance),
  spent_today: toYocto(spent),
  limits: { max_per_trade: toYocto(0.2), max_per_day: toYocto(1) },
});
const stall = (slug, stock, wants, s = state()) => ({ npc: { slug, name: slug, stock: { ...stock }, wants }, stock, state: s });
const fixedRng = () => 0;

test('a merchant short of something buys it from one with spare stock', () => {
  const deal = planDeal([stall('grob', { sword: 6 }, { potion: 2 }), stall('mira', { potion: 20 }, {})], fixedRng);
  assert.equal(deal.buyer.slug, 'grob');
  assert.equal(deal.seller.slug, 'mira');
  assert.equal(deal.itemId, 'potion');
  assert.equal(deal.quantity, 2);
});

test('no deal when nobody is short', () => {
  assert.equal(planDeal([stall('grob', { potion: 2 }, { potion: 2 }), stall('mira', { potion: 20 }, {})], fixedRng), null);
});

test('sellers never sell below what they want to keep', () => {
  assert.equal(planDeal([stall('grob', {}, { herb: 5 }), stall('mira', { herb: 40 }, { herb: 45 })], fixedRng), null);
});

test('respects the buyer budget (balance and daily limit)', () => {
  const broke = planDeal([stall('grob', {}, { potion: 2 }, state(0.001)), stall('mira', { potion: 20 }, {})], fixedRng);
  assert.equal(broke, null);
  const capped = planDeal([stall('grob', {}, { potion: 2 }, state(0.4, 0.96)), stall('mira', { potion: 20 }, {})], fixedRng);
  assert.equal(capped.quantity, 1);
});

test('paused merchants neither buy nor sell', () => {
  const paused = { ...state(), active: false };
  assert.equal(planDeal([stall('grob', {}, { potion: 2 }), stall('mira', { potion: 20 }, {}, paused)], fixedRng), null);
});
