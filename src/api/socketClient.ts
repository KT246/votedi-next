"use client";

import Pusher, { type Channel } from "pusher-js";

import { toRealtimeChannelName } from "@/lib/realtimeChannels";

const PUSHER_KEY = process.env.NEXT_PUBLIC_PUSHER_KEY?.trim() || "";
const PUSHER_CLUSTER = process.env.NEXT_PUBLIC_PUSHER_CLUSTER?.trim() || "";
const SUPPORTED_EVENTS = [
  "room:status-changed",
  "rooms:status-changed",
  "vote:new",
  "room:progress-updated",
  "room:results-reset",
] as const;

type SupportedEvent = (typeof SUPPORTED_EVENTS)[number];
type EventHandler = (payload: any) => void;
type RealtimeClient = {
  on: (eventName: SupportedEvent, handler: EventHandler) => void;
  off: (eventName: SupportedEvent, handler: EventHandler) => void;
};

let pusherClient: Pusher | null = null;
let activeConsumers = 0;
const eventListeners = new Map<SupportedEvent, Set<EventHandler>>();
const subscribedChannels = new Map<
  string,
  {
    channel: Channel;
    refCount: number;
    forwards: Map<SupportedEvent, EventHandler>;
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

function getPusherClient(): Pusher | null {
  if (!PUSHER_KEY || !PUSHER_CLUSTER) return null;

  if (!pusherClient) {
    Pusher.logToConsole = false;
    pusherClient = new Pusher(PUSHER_KEY, {
      cluster: PUSHER_CLUSTER,
      forceTLS: true,
    });
  }

  return pusherClient;
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
  return getPusherClient() ? realtimeClient : null;
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

  for (const [channelName, entry] of subscribedChannels.entries()) {
    for (const [eventName, forward] of entry.forwards.entries()) {
      entry.channel.unbind(eventName, forward);
    }
    pusherClient?.unsubscribe(channelName);
  }

  subscribedChannels.clear();
  eventListeners.clear();
  pusherClient?.disconnect();
  pusherClient = null;
};

export const joinSocketRoom = (scope: string): void => {
  const channelName = toRealtimeChannelName(scope);
  if (!channelName) return;

  const existing = subscribedChannels.get(channelName);
  if (existing) {
    existing.refCount += 1;
    return;
  }

  const pusher = getPusherClient();
  if (!pusher) return;

  const channel = pusher.subscribe(channelName);
  const forwards = new Map<SupportedEvent, EventHandler>();

  for (const eventName of SUPPORTED_EVENTS) {
    const forward: EventHandler = (payload) => dispatchEvent(eventName, payload);
    channel.bind(eventName, forward);
    forwards.set(eventName, forward);
  }

  subscribedChannels.set(channelName, {
    channel,
    refCount: 1,
    forwards,
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

  for (const [eventName, forward] of existing.forwards.entries()) {
    existing.channel.unbind(eventName, forward);
  }

  pusherClient?.unsubscribe(channelName);
  subscribedChannels.delete(channelName);
};
