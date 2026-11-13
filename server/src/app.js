import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import { env } from './config/env.js';
import { healthRouter } from './routes/health.js';
import { npcsRouter } from './routes/npcs.js';
import { tradesRouter } from './routes/trades.js';
import { metaRouter } from './routes/meta.js';
import { notFound, errorHandler } from './middleware/errors.js';

export function createApp() {
  const app = express();
  app.use(helmet());
  app.use(cors({ origin: env.allowedOrigins, credentials: true }));
  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());
  app.use('/api', rateLimit({ windowMs: 60_000, limit: 120 }));

  app.use('/api/v1/health', healthRouter);
  app.use('/api/v1/npcs', npcsRouter);
  app.use('/api/v1/trades', tradesRouter);
  app.use('/api/v1', metaRouter);

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
