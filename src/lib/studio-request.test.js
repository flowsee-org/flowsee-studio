import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { request } from '../api/studioClient.js';

const originalFetch = globalThis.fetch;
const originalStorage = globalThis.localStorage;
afterEach(() => { globalThis.fetch = originalFetch; globalThis.localStorage = originalStorage; });
test('gateway HTML is reported as an unavailable service and never shown as a JSON syntax error', async () => {
  globalThis.localStorage = { getItem: () => null };
  for (const status of [200, 502]) {
    globalThis.fetch = async () => new Response('<html><h1>Bad Gateway</h1></html>', { status, headers: { 'Content-Type': 'text/html' } });
    await assert.rejects(request('/api/health'), error => error.code === 'STUDIO_INVALID_RESPONSE'
      && error.status === status && !error.message.includes('Unexpected token') && !error.message.includes('<html>'));
  }
});
test('valid API authentication errors keep their status and message', async () => {
  globalThis.localStorage = { getItem: () => null };
  globalThis.fetch = async () => Response.json({ message: 'Invalid credentials' }, { status: 401 });
  await assert.rejects(request('/api/apps/studio/auth/login', 'POST', {}), { status: 401, message: 'Invalid credentials' });
});
