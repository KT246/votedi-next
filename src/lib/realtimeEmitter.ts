import { getAdminDb } from "@/lib/firebaseAdmin";
import type {
  RoomResultsResetPayload,
  RoomStatusChangedPayload,
} from "@/api/socketEvents";
import { adminRoomsChannel, ownerChannel, roomChannel, toRealtimeChannelName } from "@/lib/realtimeChannels";

async function triggerRealtimeEvent<T extends object>(
  event: string,
  payload: T,
  scopes: string[] = [],
): Promise<void> {
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
    const db = getAdminDb();
    const batch = db.batch();
    const createdAt = new Date();

    for (const channelName of channelNames) {
      const ref = db
        .collection("realtime_channels")
        .doc(channelName)
        .collection("events")
        .doc();

      batch.set(ref, {
        event,
        payload,
        createdAt,
      });
    }

    await batch.commit();
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

export async function emitRoomResultsReset(
  payload: RoomResultsResetPayload,
): Promise<void> {
  await triggerRealtimeEvent("room:results-reset", payload);
}
