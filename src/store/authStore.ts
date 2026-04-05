"use client";

import { create } from "zustand";

import { User } from "../types";
import {
  buildStoredUserSession,
  clearStoredUserSession,
  isStoredUserSessionExpired,
  readStoredUserSession,
  sanitizeUserSessionUser,
  USER_SESSION_KEY,
  USER_TOKEN_KEY,
} from "../lib/userSession";

interface AuthState {
  currentUser: User | null;
  isLoggedIn: boolean;
  isLoading: boolean;
  login: (user: User, token: string) => void;
  logout: () => void;
}

const SESSION_KEY = USER_SESSION_KEY;

const getInitialState = () => {
  if (typeof window === "undefined") {
    return { currentUser: null, isLoggedIn: false, isLoading: false };
  }

  const loadFromStorage = (storage: Storage) => {
    const session = readStoredUserSession(storage);
    if (!session) return null;
    if (isStoredUserSessionExpired(session)) {
      clearStoredUserSession(storage);
      return null;
    }

    const safeUser = sanitizeUserSessionUser(session.user);
    if (safeUser) {
      return { currentUser: safeUser, isLoggedIn: true, isLoading: false };
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
    const safeUser = sanitizeUserSessionUser(user);
    set({ currentUser: safeUser, isLoggedIn: true });
    if (typeof window === "undefined") return;

    const sessionData = JSON.stringify(buildStoredUserSession(safeUser, token));
    sessionStorage.setItem(SESSION_KEY, sessionData);
    localStorage.setItem(SESSION_KEY, sessionData);
    localStorage.setItem(USER_TOKEN_KEY, token);
    // Backward compatibility with old token key.
    localStorage.setItem("accessToken", token);
  },
  logout: () => {
    set({ currentUser: null, isLoggedIn: false });
    if (typeof window === "undefined") return;
    clearStoredUserSession(sessionStorage);
    clearStoredUserSession(localStorage);
  },
}));
