import axios from 'axios';
import { config } from '../config/env.js';

export const api = axios.create({ baseURL: config.apiUrl, timeout: 90_000 });

export const errorMessage = (err) => err?.response?.data?.error || err?.message || 'Something went wrong';

export const getNpcs = () => api.get('/npcs').then((r) => r.data.npcs);
export const getNpc = (slug) => api.get(`/npcs/${slug}`).then((r) => r.data.npc);
export const getConversation = (slug, accountId) =>
  api.get(`/npcs/${slug}/conversation`, { params: { accountId } }).then((r) => r.data.messages);
export const haggle = (slug, accountId, message) =>
  api.post(`/npcs/${slug}/haggle`, { accountId, message }).then((r) => r.data);
export const confirmTrade = (accountId, txHash) => api.post('/trades/confirm', { accountId, txHash }).then((r) => r.data.trade);
export const getTrades = (limit = 50) => api.get('/trades', { params: { limit } }).then((r) => r.data.trades);
export const getInventory = (accountId) => api.get(`/players/${accountId}/inventory`).then((r) => r.data.inventory);
