import type { NextFunction, Request, Response } from 'express';
import type { DecodedIdToken } from 'firebase-admin/auth';
import { adminAuth } from '../lib/firebase-admin.ts';
import { getOrCreateUser } from '../db/queries.ts';

export interface DbUserRecord {
  id: number;
  uid: string;
  email: string;
  name: string;
  phone: string | null;
  role: string;
  defaultPriorityType: string;
}

export interface AuthRequest extends Request {
  user?: DecodedIdToken;
  dbUser?: DbUserRecord;
}

export const requireAuth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Authentication required. Please sign in.' });
    return;
  }

  const token = authHeader.split('Bearer ')[1];
  try {
    const decoded = await adminAuth.verifyIdToken(token);
    req.user = decoded;
    const email = decoded.email || `${decoded.uid}@user.local`;
    const name = decoded.name || email.split('@')[0] || 'QueueLess User';
    req.dbUser = await getOrCreateUser(decoded.uid, email, name);
    next();
  } catch (error) {
    console.error('Error verifying Firebase ID token:', error);
    res.status(401).json({ error: 'Invalid or expired session. Please sign in again.' });
  }
};

export const optionalAuth = async (
  req: AuthRequest,
  _res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    next();
    return;
  }

  const token = authHeader.split('Bearer ')[1];
  try {
    const decoded = await adminAuth.verifyIdToken(token);
    req.user = decoded;
    const email = decoded.email || `${decoded.uid}@user.local`;
    const name = decoded.name || email.split('@')[0] || 'QueueLess User';
    req.dbUser = await getOrCreateUser(decoded.uid, email, name);
  } catch {
    // Ignore invalid optional auth
  }
  next();
};
