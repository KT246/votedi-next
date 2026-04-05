"use client";

import axios from "axios";

import { useAuthStore } from "../store/authStore";
import { useAdminAuthStore } from "../store/adminAuthStore";
import {
  clearStoredUserSession,
  getValidStoredUserToken,
  USER_SESSION_KEY,
} from "./userSession";

const API_URL = "/api";
const USER_DEVICE_KEY = "voterDeviceId";

const apiClient = axios.create({
  baseURL: API_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

function readSessionToken(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (key === USER_SESSION_KEY && parsed?.expiresAt && parsed.expiresAt <= Date.now()) {
      clearStoredUserSession(sessionStorage);
      clearStoredUserSession(localStorage);
      useAuthStore.getState().logout();
      return null;
    }
    return parsed?.token || null;
  } catch {
    return null;
  }
}

function resolveAccessToken(): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  const isAdminRoute = window.location.pathname.startsWith("/admin");

  if (isAdminRoute) {
    return (
      localStorage.getItem("adminAccessToken") ||
      readSessionToken("admin_session") ||
      localStorage.getItem("accessToken")
    );
  }

  return (
    localStorage.getItem("userAccessToken") ||
    getValidStoredUserToken(localStorage) ||
    readSessionToken("vote_session") ||
    localStorage.getItem("accessToken")
  );
}

function generateDeviceId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  const rand = Math.random().toString(36).slice(2);
  return `dv-${Date.now()}-${rand}${rand}`;
}

function getOrCreateDeviceId(): string | null {
  if (typeof window === "undefined") return null;
  let deviceId = localStorage.getItem(USER_DEVICE_KEY);
  if (!deviceId) {
    deviceId = generateDeviceId();
    localStorage.setItem(USER_DEVICE_KEY, deviceId);
  }
  return deviceId;
}

function clearUserSession() {
  useAuthStore.getState().logout();
}

function clearAdminSession() {
  useAdminAuthStore.getState().logoutAdmin();
}

function shouldSkipAuthHeader(url: string): boolean {
  return (
    url.includes("/auth/login") ||
    url.includes("/auth/user/login") ||
    url.includes("/auth/refresh")
  );
}

function shouldSkip401AutoRedirect(error: unknown): boolean {
  const typedError = error as { config?: { url?: string }; response?: { data?: { message?: unknown } } };
  const rawUrl = String(typedError?.config?.url || "");
  const rawMessage = typedError?.response?.data?.message;
  const message = Array.isArray(rawMessage)
    ? rawMessage.join(" ").toLowerCase()
    : String(rawMessage || "").toLowerCase();

  const hasAny = (patterns: string[]) => patterns.some((pattern) => message.includes(pattern));

  if (shouldSkipAuthHeader(rawUrl)) {
    return true;
  }

  if (rawUrl.includes("/auth/user/room-login")) {
    return hasAny([
      "only voter can check in to room",
      "room not found",
      "room is not available for check-in",
      "user is not valid",
      "user is not valid for this room",
    ]);
  }

  if (rawUrl.includes("/auth/user/change-password")) {
    return hasAny([
      "only voter can change password",
      "current password is incorrect",
      "new password must be at least",
      "new password must be different",
    ]);
  }

  return false;
}

apiClient.interceptors.request.use(
  (config) => {
    const url = String(config.url || "");
    if (shouldSkipAuthHeader(url)) {
      const deviceId = getOrCreateDeviceId();
      if (deviceId) {
        config.headers["x-device-id"] = deviceId;
      }
      return config;
    }

    const token = resolveAccessToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    const deviceId = getOrCreateDeviceId();
    if (deviceId) {
      config.headers["x-device-id"] = deviceId;
    }
    return config;
  },
  (error: unknown) => {
    return Promise.reject(error);
  },
);

apiClient.interceptors.response.use(
  (response) => response,
  async (error: unknown) => {
    const typedError = error as { response?: { status?: number } };
    const status = typedError?.response?.status;
    if (status === 401 && typeof window !== "undefined" && !shouldSkip401AutoRedirect(error)) {
      const isAdminRoute = window.location.pathname.startsWith("/admin");
      if (isAdminRoute) {
        clearAdminSession();
        if (window.location.pathname !== "/admin/login") {
          window.location.href = "/admin/login";
        }
      } else {
        clearUserSession();
        if (window.location.pathname !== "/login") {
          const redirect = `${window.location.pathname}${window.location.search || ""}`;
          window.location.href = `/login?redirect=${encodeURIComponent(redirect)}`;
        }
      }
    }
    return Promise.reject(error);
  },
);

export default apiClient;
