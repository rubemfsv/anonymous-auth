/**
 * Session management utilities.
 *
 * The session stores only the user's public key and an expiration timestamp.
 * No personal data (name, email, etc.) is ever saved — the public key is
 * the sole identifier, preserving full anonymity.
 *
 * The storage backend is injected via initSessionStorage(), keeping this
 * module decoupled from localStorage or any specific persistence layer.
 */

import type { IGetStorage } from '@/data/protocols/cache/GetStorage';
import type { ISetStorage } from '@/data/protocols/cache/SetStorage';

const SESSION_KEY = 'anonymous_auth_session';
const SESSION_DURATION_MS = 2 * 24 * 60 * 60 * 1000; // 2 days

interface SessionData {
  publicKey: string;
  expiresAt: number;
}

let storage: (IGetStorage & ISetStorage) | null = null;

export function initSessionStorage(adapter: IGetStorage & ISetStorage): void {
  storage = adapter;
}

function getStorage(): IGetStorage & ISetStorage {
  if (!storage) {
    throw new Error('Session storage not initialized. Call initSessionStorage() first.');
  }
  return storage;
}

export function saveSession(publicKey: string): void {
  const session: SessionData = { publicKey, expiresAt: Date.now() + SESSION_DURATION_MS };
  getStorage().set(SESSION_KEY, session);
}

export function loadSession(): string | null {
  try {
    const session = getStorage().get(SESSION_KEY) as SessionData | null;
    if (!session) return null;
    if (Date.now() > session.expiresAt) {
      getStorage().set(SESSION_KEY, undefined as unknown as object);
      return null;
    }
    return session.publicKey;
  } catch {
    return null;
  }
}

export function clearSession(): void {
  getStorage().set(SESSION_KEY, undefined as unknown as object);
}
