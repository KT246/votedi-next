"use client";

import { getApp, getApps, initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

function readClientConfig() {
  const apiKey = String(process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "").trim();
  const authDomain = String(
    process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "",
  ).trim();
  const projectId = String(
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "",
  ).trim();
  const storageBucket = String(
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "",
  ).trim();
  const messagingSenderId = String(
    process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "",
  ).trim();
  const appId = String(process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "").trim();

  if (!apiKey || !authDomain || !projectId || !appId) {
    return null;
  }

  return {
    apiKey,
    authDomain,
    projectId,
    ...(storageBucket ? { storageBucket } : {}),
    ...(messagingSenderId ? { messagingSenderId } : {}),
    appId,
  };
}

export function getClientDb() {
  const config = readClientConfig();
  if (!config) return null;

  const app = getApps().length > 0 ? getApp() : initializeApp(config);
  return getFirestore(app);
}
