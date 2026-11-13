import { Router } from 'express';
import mongoose from 'mongoose';
import { env } from '../config/env.js';

export const healthRouter = Router();

healthRouter.get('/', (_req, res) => {
  res.json({
    ok: true,
    app: env.appName,
    network: env.near.network,
    db: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
  });
});
