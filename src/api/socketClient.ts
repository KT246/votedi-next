"use client";

import {
  collection,
  onSnapshot,
  orderBy,
  query,
  startAt,
  Timestamp,
} from "firebase/firestore";

import { getClientDb } from "@/lib/firebaseClient";
import { toRealtimeChannelName } from "@/lib/realtimeChannels";

const SUPPORTED_EVENTS = [
  "room:status-changed",
  "rooms:status-changed",
  "room:results-reset",
] as const;

type SupportedEvent = (typeof SUPPORTED_EVENTS)[number];
type EventHandler = { bivarianceHack(payload: unknown): void }["bivarianceHack"];
type RealtimeClient = {
  on: (eventName: SupportedEvent, handler: EventHandler) => void;
  off: (eventName: SupportedEvent, handler: EventHandler) => void;
};

let activeConsumers = 0;
const eventListeners = new Map<SupportedEvent, Set<EventHandler>>();
const subscribedChannels = new Map<
  string,
  {
    refCount: number;
    unsubscribe: () => void;
  }
>();

function dispatchEvent(eventName: SupportedEvent, payload: unknown) {
  const handlers = eventListeners.get(eventName);
  if (!handlers?.size) return;

  for (const handler of handlers) {
    try {
      handler(payload);
    } catch (error) {
      console.error(`[realtime] failed to handle ${eventName}:`, error);
    }
  }
}

function getOrCreateListeners(eventName: SupportedEvent): Set<EventHandler> {
  const existing = eventListeners.get(eventName);
  if (existing) return existing;

  const next = new Set<EventHandler>();
  eventListeners.set(eventName, next);
  return next;
}

function getRealtimeDb() {
  return getClientDb();
}

const realtimeClient: RealtimeClient = {
  on(eventName, handler) {
    getOrCreateListeners(eventName).add(handler);
  },
  off(eventName, handler) {
    eventListeners.get(eventName)?.delete(handler);
  },
};

export const getSocket = (): RealtimeClient | null => {
  return getRealtimeDb() ? realtimeClient : null;
};

export const acquireSocket = (): RealtimeClient | null => {
  const client = getSocket();
  if (!client) return null;
  activeConsumers += 1;
  return client;
};

export const releaseSocket = (): void => {
  activeConsumers = Math.max(0, activeConsumers - 1);
  if (activeConsumers > 0) return;

  for (const [, entry] of subscribedChannels.entries()) {
    entry.unsubscribe();
  }

  subscribedChannels.clear();
  eventListeners.clear();
};

export const joinSocketRoom = (scope: string): void => {
  const channelName = toRealtimeChannelName(scope);
  if (!channelName) return;

  const existing = subscribedChannels.get(channelName);
  if (existing) {
    existing.refCount += 1;
    return;
  }

  const realtimeDb = getRealtimeDb();
  if (!realtimeDb) return;

  const connectedAt = Timestamp.fromDate(new Date());
  const eventsRef = collection(
    realtimeDb,
    "realtime_channels",
    channelName,
    "events",
  );
  const eventsQuery = query(eventsRef, orderBy("createdAt", "asc"), startAt(connectedAt));
  const unsubscribe = onSnapshot(eventsQuery, (snapshot) => {
    snapshot.docChanges().forEach((change) => {
      if (change.type !== "added") return;

      const data = change.doc.data() as {
        event?: SupportedEvent;
        payload?: unknown;
      };

      if (!data.event || !SUPPORTED_EVENTS.includes(data.event)) {
        return;
      }

      dispatchEvent(data.event, data.payload);
    });
  });

  subscribedChannels.set(channelName, {
    refCount: 1,
    unsubscribe,
  });
};

export const leaveSocketRoom = (scope: string): void => {
  const channelName = toRealtimeChannelName(scope);
  if (!channelName) return;

  const existing = subscribedChannels.get(channelName);
  if (!existing) return;

  if (existing.refCount > 1) {
    existing.refCount -= 1;
    return;
  }

  existing.unsubscribe();
  subscribedChannels.delete(channelName);
};
