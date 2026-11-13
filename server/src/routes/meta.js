import { Router } from 'express';
import { ITEMS } from '../config/world.js';
import { env } from '../config/env.js';
import { inventoryOf } from '../services/market.js';
import { nearAccountId } from '../middleware/validate.js';

export const metaRouter = Router();

metaRouter.get('/config', (_req, res) => {
  res.json({
    network: env.near.network,
    marketContractId: env.near.marketContractId,
    explorerUrl: env.near.explorerUrl,
    items: ITEMS,
  });
});

metaRouter.get('/players/:accountId/inventory', async (req, res, next) => {
  const { error } = nearAccountId.validate(req.params.accountId);
  if (error) return next(Object.assign(new Error('Invalid account id'), { status: 400 }));
  res.json({ inventory: await inventoryOf(req.params.accountId) });
});
