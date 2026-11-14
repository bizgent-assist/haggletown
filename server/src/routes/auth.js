import { randomBytes } from 'node:crypto';
import { Router } from 'express';
import Joi from 'joi';
import rateLimit from 'express-rate-limit';
import { AuthNonce } from '../models/AuthNonce.js';
import { Player } from '../models/Player.js';
import { verifySignedMessage } from '../services/nep413.js';
import { rpc } from '../services/near.js';
import { issueToken, requireAuth } from '../middleware/auth.js';
import { validate, nearAccountId } from '../middleware/validate.js';

export const authRouter = Router();

export const SIGN_IN_MESSAGE = 'Sign in to Haggletown';
export const SIGN_IN_RECIPIENT = 'haggletown';

authRouter.use(rateLimit({ windowMs: 60_000, limit: 20 }));

authRouter.get('/challenge', async (_req, res) => {
  const nonce = randomBytes(32).toString('base64');
  await AuthNonce.create({ nonce });
  res.json({ message: SIGN_IN_MESSAGE, recipient: SIGN_IN_RECIPIENT, nonce });
});

/** Is publicKey a full-access key of accountId right now? */
async function isFullAccessKey(accountId, publicKey) {
  try {
    const key = await rpc('query', {
      request_type: 'view_access_key', finality: 'final', account_id: accountId, public_key: publicKey,
    });
    return key.permission === 'FullAccess';
  } catch {
    return false;
  }
}

authRouter.post(
  '/verify',
  validate({
    body: Joi.object({
      accountId: nearAccountId.required(),
      publicKey: Joi.string().pattern(/^ed25519:[1-9A-HJ-NP-Za-km-z]{32,44}$/).required(),
      signature: Joi.string().max(200).required(),
      nonce: Joi.string().base64().length(44).required(),
    }),
  }),
  async (req, res) => {
    const { accountId, publicKey, signature, nonce } = req.body;
    const used = await AuthNonce.findOneAndDelete({ nonce });
    if (!used) return res.status(400).json({ error: 'Sign-in challenge expired. Try again.' });

    const valid = verifySignedMessage({
      publicKey, signature, message: SIGN_IN_MESSAGE, nonce: Buffer.from(nonce, 'base64'), recipient: SIGN_IN_RECIPIENT,
    });
    if (!valid) return res.status(401).json({ error: 'Signature check failed' });
    if (!(await isFullAccessKey(accountId, publicKey))) {
      return res.status(401).json({ error: 'That key is not a full-access key of this account' });
    }
    await Player.updateOne({ nearAccountId: accountId }, { $setOnInsert: { nearAccountId: accountId } }, { upsert: true });
    res.json({ token: issueToken(accountId), accountId });
  },
);

authRouter.get('/me', requireAuth, async (req, res) => {
  const player = await Player.findOne({ nearAccountId: req.player }).lean();
  res.json({ accountId: req.player, email: player?.email || '', emailNotifications: Boolean(player?.emailNotifications) });
});

authRouter.put(
  '/me',
  requireAuth,
  validate({
    body: Joi.object({ email: Joi.string().email().allow('').max(200), emailNotifications: Joi.boolean() }),
  }),
  async (req, res) => {
    const update = {};
    if (req.body.email !== undefined) update.email = req.body.email;
    if (req.body.emailNotifications !== undefined) update.emailNotifications = req.body.emailNotifications;
    if (update.email === '') update.emailNotifications = false;
    const player = await Player.findOneAndUpdate({ nearAccountId: req.player }, { $set: update }, { new: true, upsert: true }).lean();
    res.json({ accountId: req.player, email: player.email || '', emailNotifications: Boolean(player.emailNotifications) });
  },
);
