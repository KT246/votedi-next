"use client";
import { create } from "zustand";
import { User } from "../types";

interface AuthState {
  currentUser: User | null;
  isLoggedIn: boolean;
  isLoading: boolean;
  login: (user: User, token: string) => void;
  logout: () => void;
}

const SESSION_KEY = "vote_session";
const USER_TOKEN_KEY = "userAccessToken";

function sanitizeUser(user: User | null): User | null {
  if (!user) return null;
  const safeUser = { ...user };
  delete safeUser.studentId;
  return safeUser;
}

const getInitialState = () => {
  if (typeof window === "undefined") {
    return { currentUser: null, isLoggedIn: false, isLoading: false };
  }

  const loadFromStorage = (storage: Storage) => {
    const saved = storage.getItem(SESSION_KEY);
    if (!saved) return null;
    try {
      const parsed = JSON.parse(saved);
      const user = parsed?.user as User | null;
      const safeUser = sanitizeUser(user);
      if (user && "studentId" in user) {
        storage.setItem(
          SESSION_KEY,
          JSON.stringify({ ...parsed, user: safeUser }),
        );
      }
      if (safeUser) {
        return { currentUser: safeUser, isLoggedIn: true, isLoading: false };
      }
    } catch {
      storage.removeItem(SESSION_KEY);
    }
    return null;
  };

  const sessionState = loadFromStorage(sessionStorage);
  if (sessionState) return sessionState;

  const localState = loadFromStorage(localStorage);
  if (localState) {
    // Keep sessionStorage in sync with localStorage for the current tab.
    sessionStorage.setItem(
      SESSION_KEY,
      localStorage.getItem(SESSION_KEY) ?? "",
    );
    return localState;
  }

  return { currentUser: null, isLoggedIn: false, isLoading: false };
};

export const useAuthStore = create<AuthState>((set) => ({
  ...getInitialState(),
  login: (user: User, token: string) => {
    const safeUser = sanitizeUser(user);
    set({ currentUser: safeUser, isLoggedIn: true });
    if (typeof window === "undefined") return;
    const sessionData = JSON.stringify({ user: safeUser, token });
    sessionStorage.setItem(SESSION_KEY, sessionData);
    localStorage.setItem(SESSION_KEY, sessionData);
    localStorage.setItem(USER_TOKEN_KEY, token);
    // Backward compatibility with old token key.
    localStorage.setItem("accessToken", token);
  },
  logout: () => {
    set({ currentUser: null, isLoggedIn: false });
    if (typeof window === "undefined") return;
    sessionStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(USER_TOKEN_KEY);
    localStorage.removeItem("accessToken");
  },
}));
