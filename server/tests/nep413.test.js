import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { KeyPair } from 'near-api-js';
import { payloadHash, verifySignedMessage } from '../src/services/nep413.js';

const message = 'Sign in to Haggletown';
const recipient = 'haggletown';

function signAs(kp, nonce, msg = message) {
  const { signature } = kp.sign(payloadHash({ message: msg, nonce, recipient }));
  return Buffer.from(signature).toString('base64');
}

test('accepts a valid NEP-413 signature', () => {
  const kp = KeyPair.fromRandom('ed25519');
  const nonce = randomBytes(32);
  const signature = signAs(kp, nonce);
  assert.equal(verifySignedMessage({ publicKey: kp.getPublicKey().toString(), signature, message, nonce, recipient }), true);
});

test('rejects a signature from another key', () => {
  const nonce = randomBytes(32);
  const signature = signAs(KeyPair.fromRandom('ed25519'), nonce);
  const other = KeyPair.fromRandom('ed25519').getPublicKey().toString();
  assert.equal(verifySignedMessage({ publicKey: other, signature, message, nonce, recipient }), false);
});

test('rejects a replay with a different nonce or message', () => {
  const kp = KeyPair.fromRandom('ed25519');
  const nonce = randomBytes(32);
  const signature = signAs(kp, nonce);
  const pk = kp.getPublicKey().toString();
  assert.equal(verifySignedMessage({ publicKey: pk, signature, message, nonce: randomBytes(32), recipient }), false);
  assert.equal(verifySignedMessage({ publicKey: pk, signature, message: 'Pay me', nonce, recipient }), false);
});

test('garbage input is rejected, not thrown', () => {
  assert.equal(verifySignedMessage({ publicKey: 'nope', signature: 'x', message, nonce: randomBytes(32), recipient }), false);
});
