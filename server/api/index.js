// Vercel serverless entry: the same Express app, with a cached MongoDB connection.
// The market tick runs via POST /api/v1/market/tick (nudged by visitors) instead of a timer.
import { createApp } from '../src/app.js';
import { connectDb } from '../src/db.js';

const app = createApp();
let connecting;

export default async function handler(req, res) {
  connecting ??= connectDb().catch((err) => {
    connecting = undefined;
    throw err;
  });
  await connecting;
  return app(req, res);
}
