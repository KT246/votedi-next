"use client";

import { useEffect } from "react";

import { useAuthStore } from "../store/authStore";
import {
  clearStoredUserSession,
  isStoredUserSessionExpired,
  readStoredUserSession,
  USER_SESSION_KEY,
  USER_TOKEN_KEY,
} from "../lib/userSession";

export default function UserSessionTimeoutWatcher() {
  const isLoggedIn = useAuthStore((state) => state.isLoggedIn);

  useEffect(() => {
    if (!isLoggedIn || typeof window === "undefined") return;

    const logout = useAuthStore.getState().logout;
    let timerId: number | null = null;

    const clearTimer = () => {
      if (timerId !== null) {
        window.clearTimeout(timerId);
        timerId = null;
      }
    };

    const expireNow = () => {
      clearTimer();
      clearStoredUserSession(sessionStorage);
      clearStoredUserSession(localStorage);
      logout();
    };

    const schedule = () => {
      clearTimer();
      const session = readStoredUserSession(localStorage);
      if (!session?.expiresAt) return;

      const remaining = session.expiresAt - Date.now();
      if (remaining <= 0) {
        expireNow();
        return;
      }

      timerId = window.setTimeout(expireNow, remaining);
    };

    const handleStorage = (event: StorageEvent) => {
      if (
        event.key &&
        event.key !== USER_SESSION_KEY &&
        event.key !== USER_TOKEN_KEY &&
        event.key !== "accessToken"
      ) {
        return;
      }

      const session = readStoredUserSession(localStorage);
      if (!session || isStoredUserSessionExpired(session)) {
        expireNow();
        return;
      }

      schedule();
    };

    const handleActivity = () => {
      const session = readStoredUserSession(localStorage);
      if (!session || isStoredUserSessionExpired(session)) {
        expireNow();
      }
    };

    schedule();
    window.addEventListener("storage", handleStorage);
    window.addEventListener("focus", handleActivity);
    document.addEventListener("visibilitychange", handleActivity);

    return () => {
      clearTimer();
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("focus", handleActivity);
      document.removeEventListener("visibilitychange", handleActivity);
    };
  }, [isLoggedIn]);

  return null;
}
