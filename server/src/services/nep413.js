// NEP-413 signed-message verification (wallet sign-in without a transaction).
// https://github.com/near/NEPs/blob/master/neps/nep-0413.md
import { createHash } from 'node:crypto';
import { PublicKey } from 'near-api-js';

const TAG = 2 ** 31 + 413;

function borshString(s) {
  const bytes = Buffer.from(s, 'utf8');
  const len = Buffer.alloc(4);
  len.writeUInt32LE(bytes.length);
  return Buffer.concat([len, bytes]);
}

/** sha256(borsh(tag) ++ borsh(payload)) — the bytes a NEP-413 wallet signs. */
export function payloadHash({ message, nonce, recipient, callbackUrl = null }) {
  if (nonce.length !== 32) throw new Error('nonce must be 32 bytes');
  const tag = Buffer.alloc(4);
  tag.writeUInt32LE(TAG);
  const parts = [tag, borshString(message), Buffer.from(nonce), borshString(recipient)];
  parts.push(callbackUrl == null ? Buffer.from([0]) : Buffer.concat([Buffer.from([1]), borshString(callbackUrl)]));
  return createHash('sha256').update(Buffer.concat(parts)).digest();
}

function decodeSignature(signature) {
  if (signature instanceof Uint8Array) return signature;
  const s = String(signature);
  return Buffer.from(s.startsWith('ed25519:') ? s.slice(8) : s, 'base64');
}

/** True when `signature` is publicKey's valid ed25519 signature over the NEP-413 payload. */
export function verifySignedMessage({ publicKey, signature, message, nonce, recipient, callbackUrl }) {
  try {
    const hash = payloadHash({ message, nonce, recipient, callbackUrl });
    return PublicKey.fromString(publicKey).verify(hash, decodeSignature(signature));
  } catch {
    return false;
  }
}
