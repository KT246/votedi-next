import { getRoomById, syncRoomResultsForRoom, updateRoom, type RoomRecord } from './firestoreData';
import { emitRoomLifecycleChanged } from './realtimeEmitter';

type DateLike = Date | string | null | undefined;

export type RoomLifecycleDocument = {
    id?: string;
    roomCode?: string;
    ownerAdminId?: string;
    status?: unknown;
    startTime?: DateLike;
    endTime?: DateLike;
    timeMode?: unknown;
    durationMinutes?: unknown;
    updatedAt?: DateLike;
};

function toDateMs(value: DateLike): number | null {
    if (!(value instanceof Date)) {
        if (typeof value !== 'string') return null;
        const parsed = Date.parse(value);
        return Number.isNaN(parsed) ? null : parsed;
    }

    const ts = value.getTime();
    return Number.isNaN(ts) ? null : ts;
}

function normalizeRoomKey(value: unknown): string {
    if (!value) return '';
    if (typeof value === 'string') return value.trim();
    if (typeof value === 'number') return String(value);
    if (typeof value === 'object') {
        const raw = value as { $oid?: unknown; id?: unknown; _id?: unknown; toString?: () => string };
        if (typeof raw.$oid === 'string') return raw.$oid;
        if (typeof raw.id === 'string') return raw.id;
        if (typeof raw._id === 'string') return raw._id;
        if (typeof raw.toString === 'function') {
            const result = raw.toString();
            if (result && result !== '[object Object]') return result;
        }
    }
    return String(value);
}

export function getRoomDeadline(room: Pick<RoomLifecycleDocument, 'startTime' | 'endTime' | 'timeMode' | 'durationMinutes'>): Date | null {
    const endTimeMs = toDateMs(room.endTime);
    if (endTimeMs !== null) return new Date(endTimeMs);

    const startTimeMs = toDateMs(room.startTime);
    if (
        startTimeMs !== null &&
        (room.timeMode === 'duration' || room.timeMode === undefined) &&
        Number.isFinite(Number(room.durationMinutes)) &&
        Number(room.durationMinutes) > 0
    ) {
        return new Date(startTimeMs + Number(room.durationMinutes) * 60 * 1000);
    }

    return null;
}

export async function autoCloseExpiredRoom<T extends RoomLifecycleDocument>(
    room: T,
): Promise<T> {
    const status = String(room.status || '').toLowerCase();
    if (status !== 'open') return room;

    const deadline = getRoomDeadline(room);
    if (!deadline || Date.now() < deadline.getTime()) return room;

    const roomId = normalizeRoomKey(room.id);
    if (!roomId) return room;

    await updateRoom(roomId, {
        status: 'closed',
        updatedAt: new Date(),
    });

    const updated = (await getRoomById(roomId)) as RoomRecord | null;
    const resolvedRoom = (updated || room) as T;
    if (updated) {
        await syncRoomResultsForRoom(updated);
    }
    const normalizedRoomId = normalizeRoomKey(resolvedRoom.id) || normalizeRoomKey(resolvedRoom.roomCode);

    if (normalizedRoomId) {
        await emitRoomLifecycleChanged({
            roomId: normalizedRoomId,
            status: 'closed',
            ownerAdminId: typeof resolvedRoom.ownerAdminId === 'string' ? resolvedRoom.ownerAdminId : '',
        });
    }
    return resolvedRoom;
}
