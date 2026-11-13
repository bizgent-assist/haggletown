import dns from 'node:dns';
import mongoose from 'mongoose';
import { env } from './config/env.js';

export async function connectDb(uri = env.mongoUri()) {
  // Some Windows setups refuse SRV lookups from Node's default resolver; allow explicit DNS servers.
  if (process.env.DNS_SERVERS) dns.setServers(process.env.DNS_SERVERS.split(',').map((s) => s.trim()));
  mongoose.set('strictQuery', true);
  await mongoose.connect(uri);
  return mongoose.connection;
}
