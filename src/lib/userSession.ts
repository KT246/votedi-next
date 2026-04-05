import type { User } from "../types";

export const USER_SESSION_KEY = "vote_session";
export const USER_TOKEN_KEY = "userAccessToken";
export const USER_SESSION_MAX_AGE_MS = 30 * 60 * 1000;

export type StoredUserSession = {
  user?: User | null;
  token?: string;
  expiresAt?: number;
};

export function sanitizeUserSessionUser(user: User | null | undefined): User | null {
  if (!user) return null;
  const safeUser = { ...user };
  delete safeUser.studentId;
  return safeUser;
}

export function buildStoredUserSession(user: User | null, token: string, now = Date.now()) {
  return {
    user: sanitizeUserSessionUser(user),
    token,
    expiresAt: now + USER_SESSION_MAX_AGE_MS,
  };
}

export function readStoredUserSession(storage: Storage | null | undefined): StoredUserSession | null {
  if (!storage) return null;
  const saved = storage.getItem(USER_SESSION_KEY);
  if (!saved) return null;
  try {
    const parsed = JSON.parse(saved) as StoredUserSession;
    return parsed || null;
  } catch {
    storage.removeItem(USER_SESSION_KEY);
    return null;
  }
}

export function isStoredUserSessionExpired(
  session: StoredUserSession | null | undefined,
  now = Date.now(),
): boolean {
  if (!session?.expiresAt) return false;
  return session.expiresAt <= now;
}

export function clearStoredUserSession(storage: Storage | null | undefined) {
  if (!storage) return;
  storage.removeItem(USER_SESSION_KEY);
  storage.removeItem(USER_TOKEN_KEY);
  storage.removeItem("accessToken");
}

export function getValidStoredUserToken(storage: Storage | null | undefined): string | null {
  const session = readStoredUserSession(storage);
  if (!session?.token) return null;
  if (isStoredUserSessionExpired(session)) {
    clearStoredUserSession(storage);
    return null;
  }
  return session.token;
}
