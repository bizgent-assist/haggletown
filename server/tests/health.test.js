import { test } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createApp } from '../src/app.js';

test('GET /api/v1/health responds ok', async () => {
  const res = await request(createApp()).get('/api/v1/health');
  assert.equal(res.status, 200);
  assert.equal(res.body.ok, true);
});
