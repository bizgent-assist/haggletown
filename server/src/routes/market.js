import { Router } from 'express';
import { MarketState } from '../models/MarketState.js';
import { runTick } from '../services/tick.js';

export const marketRouter = Router();
const MIN_INTERVAL_MS = 120_000;

/**
 * Visitors' browsers nudge the market here. A shared lock in MongoDB lets at most one tick
 * through every 2 minutes, however many visitors there are, so this cannot be used to burn gas.
 */
marketRouter.post('/tick', async (_req, res) => {
  const now = new Date();
  try {
    await MarketState.findOneAndUpdate(
      { _id: 'tick', lastTickAt: { $lt: new Date(now - MIN_INTERVAL_MS) } },
      { $set: { lastTickAt: now } },
      { upsert: true },
    );
  } catch (err) {
    if (err.code === 11000) return res.json({ ran: false, reason: 'not due yet' });
    throw err;
  }
  const result = await runTick();
  res.json({ ran: true, deal: result.deal || null });
});
