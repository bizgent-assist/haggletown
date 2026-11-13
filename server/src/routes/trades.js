import { Router } from 'express';
import Joi from 'joi';
import { Trade } from '../models/Trade.js';
import { Conversation } from '../models/Conversation.js';
import { verifyAcceptTx } from '../services/near.js';
import { validate, nearAccountId } from '../middleware/validate.js';

export const tradesRouter = Router();

/** The client reports a signed accept_offer; the server verifies it on-chain before recording it. */
tradesRouter.post(
  '/confirm',
  validate({
    body: Joi.object({
      accountId: nearAccountId.required(),
      txHash: Joi.string().pattern(/^[1-9A-HJ-NP-Za-km-z]{43,44}$/).required(),
    }),
  }),
  async (req, res) => {
    const { accountId, txHash } = req.body;
    const existing = await Trade.findOne({ txHash }).lean();
    if (existing) return res.json({ trade: existing });

    const event = await verifyAcceptTx(txHash, accountId);
    const trade = await Trade.create({
      kind: event.buyer === accountId ? 'player_buy' : 'player_sell',
      offerId: event.offer_id,
      buyer: event.buyer,
      seller: event.seller,
      itemId: event.item_id,
      quantity: event.quantity,
      unitPrice: event.unit_price,
      total: event.total,
      txHash,
    });
    await Conversation.updateOne(
      { player: accountId, 'messages.offer.offerId': event.offer_id },
      { $set: { 'messages.$.offer.status': 'accepted' } },
    );
    res.status(201).json({ trade });
  },
);

tradesRouter.get('/', async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 50, 100);
  const trades = await Trade.find().sort({ createdAt: -1 }).limit(limit).lean();
  res.json({ trades });
});
