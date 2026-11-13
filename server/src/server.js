import { env } from './config/env.js';
import { connectDb } from './db.js';
import { createApp } from './app.js';

await connectDb();
createApp().listen(env.port, () => {
  console.log(`${env.appName} API listening on http://localhost:${env.port}`);
});
