import { Router } from 'express';
import Joi from 'joi';
import rateLimit from 'express-rate-limit';
import { NPCS } from '../config/world.js';
import { Conversation } from '../models/Conversation.js';
import { findNpc, inventoryOf, publicStall, stallOf } from '../services/market.js';
import { haggleTurn } from '../services/haggle.js';
import { validate } from '../middleware/validate.js';
import { requireAuth } from '../middleware/auth.js';

export const npcsRouter = Router();
const MAX_MESSAGES = 60;

function requireNpc(req, _res, next) {
  const npc = findNpc(req.params.slug);
  if (!npc) return next(Object.assign(new Error('No such merchant'), { status: 404 }));
  req.npc = npc;
  return next();
}

npcsRouter.get('/', async (_req, res) => {
  const stalls = await Promise.all(NPCS.map(stallOf));
  res.json({ npcs: stalls.map(publicStall) });
});

npcsRouter.get('/:slug', requireNpc, async (req, res) => {
  res.json({ npc: publicStall(await stallOf(req.npc)) });
});

npcsRouter.get(
  '/:slug/conversation',
  requireAuth,
  requireNpc,
  async (req, res) => {
    const convo = await Conversation.findOne({ player: req.player, npcSlug: req.npc.slug }).lean();
    res.json({ messages: expireOffers(convo?.messages ?? []) });
  },
);

const haggleLimiter = rateLimit({ windowMs: 60_000, limit: 15, keyGenerator: (req) => req.player, message: { error: 'Slow down — the merchant needs a breath.' } });

npcsRouter.post(
  '/:slug/haggle',
  requireAuth,
  haggleLimiter,
  requireNpc,
  validate({
    body: Joi.object({ message: Joi.string().trim().min(1).max(400).required() }),
  }),
  async (req, res) => {
    const { message } = req.body;
    const accountId = req.player;
    const [stall, playerStock] = await Promise.all([stallOf(req.npc), inventoryOf(accountId)]);
    if (!stall.active) return res.status(409).json({ error: `${req.npc.name}'s stall is closed.` });

    const convo =
      (await Conversation.findOne({ player: accountId, npcSlug: req.npc.slug })) ||
      new Conversation({ player: accountId, npcSlug: req.npc.slug, messages: [] });

    const reply = await haggleTurn({
      npc: req.npc, stall, playerAccountId: accountId, playerStock, history: convo.messages, message,
    });
    convo.messages.push({ role: 'player', text: message }, reply);
    if (convo.messages.length > MAX_MESSAGES) convo.messages = convo.messages.slice(-MAX_MESSAGES);
    await convo.save();
    res.json({ reply: convo.messages.at(-1), npc: publicStall(stall) });
  },
);

function expireOffers(messages) {
  const now = Date.now();
  return messages.map((m) =>
    m.offer && m.offer.status === 'open' && m.offer.expiresAtMs <= now ? { ...m, offer: { ...m.offer, status: 'expired' } } : m,
  );
}
