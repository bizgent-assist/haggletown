import axios from 'axios';
import { config } from '../config/env.js';
import { loadSession } from './session.js';

export const api = axios.create({ baseURL: config.apiUrl, timeout: 90_000 });

api.interceptors.request.use((req) => {
  const session = loadSession();
  if (session?.token) req.headers.Authorization = `Bearer ${session.token}`;
  return req;
});

export const errorMessage = (err) => err?.response?.data?.error || err?.message || 'Something went wrong';

export const getNpcs = () => api.get('/npcs').then((r) => r.data.npcs);
export const getNpc = (slug) => api.get(`/npcs/${slug}`).then((r) => r.data.npc);
export const getConversation = (slug) => api.get(`/npcs/${slug}/conversation`).then((r) => r.data.messages);
export const haggle = (slug, message) => api.post(`/npcs/${slug}/haggle`, { message }).then((r) => r.data);
export const confirmTrade = (txHash) => api.post('/trades/confirm', { txHash }).then((r) => r.data.trade);
export const getTrades = (limit = 50) => api.get('/trades', { params: { limit } }).then((r) => r.data.trades);
export const getInventory = (accountId) => api.get(`/players/${accountId}/inventory`).then((r) => r.data.inventory);
export const nudgeMarket = () => api.post('/market/tick').then((r) => r.data);

export const getChallenge = () => api.get('/auth/challenge').then((r) => r.data);
export const verifySignIn = (body) => api.post('/auth/verify', body).then((r) => r.data);
export const getMe = () => api.get('/auth/me').then((r) => r.data);
export const updateMe = (body) => api.put('/auth/me', body).then((r) => r.data);
