import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

export function issueToken(accountId) {
  return jwt.sign({ sub: accountId }, env.jwtSecret(), { expiresIn: env.jwtExpiresIn });
}

/** Requires `Authorization: Bearer <token>` from wallet sign-in; sets req.player to the NEAR account id. */
export function requireAuth(req, _res, next) {
  const header = req.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return next(Object.assign(new Error('Sign in with your wallet first'), { status: 401 }));
  try {
    req.player = jwt.verify(token, env.jwtSecret()).sub;
    return next();
  } catch {
    return next(Object.assign(new Error('Your sign-in expired. Sign in again.'), { status: 401 }));
  }
}
