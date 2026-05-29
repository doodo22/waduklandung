import { randomBytes, createHmac } from 'crypto';

const SESSION_SECRET = process.env.SESSION_SECRET || 'rt-management-secret-key-2024';

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const hash = createHmac('sha256', salt + SESSION_SECRET).update(password).digest('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(':');
  const verifyHash = createHmac('sha256', salt + SESSION_SECRET).update(password).digest('hex');
  return hash === verifyHash;
}

export function generateToken(userId: string): string {
  const payload = `${userId}:${Date.now()}`;
  const signature = createHmac('sha256', SESSION_SECRET).update(payload).digest('hex');
  return Buffer.from(`${payload}:${signature}`).toString('base64');
}

export function verifyToken(token: string): string | null {
  try {
    const decoded = Buffer.from(token, 'base64').toString();
    const [userId, timestamp, signature] = decoded.split(':');
    const expectedSignature = createHmac('sha256', SESSION_SECRET)
      .update(`${userId}:${timestamp}`)
      .digest('hex');
    if (signature !== expectedSignature) return null;
    // Token valid for 7 days
    const tokenAge = Date.now() - parseInt(timestamp);
    if (tokenAge > 7 * 24 * 60 * 60 * 1000) return null;
    return userId;
  } catch {
    return null;
  }
}
