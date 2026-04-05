import Pusher from "pusher";

import type {
  RoomProgressUpdatedPayload,
  RoomResultsResetPayload,
  RoomStatusChangedPayload,
  VoteNewPayload,
} from "@/api/socketEvents";
import {
  adminRoomsChannel,
  ownerChannel,
  roomChannel,
  toRealtimeChannelName,
} from "@/lib/realtimeChannels";

let cachedPusher: Pusher | null | undefined;

function normalizeString(value: unknown): string {
  return typeof value === "string" ? value.trim() : String(value || "").trim();
}

function getPusherServer(): Pusher | null {
  if (cachedPusher !== undefined) return cachedPusher;

  const appId = normalizeString(process.env.PUSHER_APP_ID);
  const key = normalizeString(process.env.NEXT_PUBLIC_PUSHER_KEY);
  const secret = normalizeString(process.env.PUSHER_SECRET);
  const cluster = normalizeString(process.env.NEXT_PUBLIC_PUSHER_CLUSTER);

  if (!appId || !key || !secret || !cluster) {
    cachedPusher = null;
    return cachedPusher;
  }

  cachedPusher = new Pusher({
    appId,
    key,
    secret,
    cluster,
    useTLS: true,
  });

  return cachedPusher;
}

async function triggerRealtimeEvent<T extends object>(
  event: string,
  payload: T,
  scopes: string[] = [],
): Promise<void> {
  const pusher = getPusherServer();
  if (!pusher) return;

  const channelNames = new Set<string>();

  for (const scope of scopes) {
    const channelName = toRealtimeChannelName(scope);
    if (channelName) {
      channelNames.add(channelName);
    }
  }

  if ("roomId" in payload && payload.roomId) {
    const channelName = roomChannel(payload.roomId);
    if (channelName) {
      channelNames.add(channelName);
    }
  }

  if ("ownerAdminId" in payload && payload.ownerAdminId) {
    const channelName = ownerChannel(payload.ownerAdminId);
    if (channelName) {
      channelNames.add(channelName);
    }
  }

  if (channelNames.size === 0) return;

  try {
    await pusher.trigger(Array.from(channelNames), event, payload);
  } catch (error) {
    console.error(`[realtime] failed to emit ${event}:`, error);
  }
}

export async function emitRoomStatusChanged(
  payload: RoomStatusChangedPayload,
): Promise<void> {
  await triggerRealtimeEvent("room:status-changed", payload);
}

export async function emitRoomsStatusChanged(
  payload: RoomStatusChangedPayload,
): Promise<void> {
  await triggerRealtimeEvent("rooms:status-changed", payload, [
    adminRoomsChannel(),
  ]);
}

export async function emitRoomLifecycleChanged(
  payload: RoomStatusChangedPayload,
): Promise<void> {
  await Promise.allSettled([
    emitRoomStatusChanged(payload),
    emitRoomsStatusChanged(payload),
  ]);
}

export async function emitVoteNew(payload: VoteNewPayload): Promise<void> {
  await triggerRealtimeEvent("vote:new", payload);
}

export async function emitRoomProgressUpdated(
  payload: RoomProgressUpdatedPayload,
): Promise<void> {
  await triggerRealtimeEvent("room:progress-updated", payload);
}

export async function emitRoomResultsReset(
  payload: RoomResultsResetPayload,
): Promise<void> {
  await triggerRealtimeEvent("room:results-reset", payload);
}
