import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';

import { getAuthContext } from '@/lib/serverAuth';
import { autoCloseExpiredRoom, getVoteRoomKeys } from '@/lib/roomLifecycle';

type VoteDoc = {
    roomId: string;
    roomCode: string;
    userId: string;
    selectedIds: string[];
    votedAt: Date;
};

type RoomDocument = {
    _id?: ObjectId;
    roomCode?: string;
    status?: unknown;
    startTime?: Date | null;
    endTime?: Date | null;
    timeMode?: unknown;
    durationMinutes?: unknown;
    updatedAt?: Date | null;
};

function normalizeSelection(value: unknown): string[] {
    if (!Array.isArray(value)) return [];
    return value.map((entry) => String(entry).trim()).filter(Boolean);
}

async function findRoomByKey(
    db: { collection: (name: string) => { findOne: (query: Record<string, unknown>) => Promise<{ _id?: ObjectId; roomCode?: string } | null> } },
    roomKey: string,
) {
    const directByStringId = await db.collection('rooms').findOne({ _id: roomKey });
    if (directByStringId) return directByStringId;

    if (ObjectId.isValid(roomKey) && String(new ObjectId(roomKey)) === roomKey) {
        const byObjectId = await db.collection('rooms').findOne({ _id: new ObjectId(roomKey) });
        if (byObjectId) return byObjectId;
    }

    return db.collection('rooms').findOne({ roomCode: roomKey });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ roomId: string }> }) {
    const auth = await getAuthContext(request, 'user');
    if (!auth?.payload.id) {
        return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const { roomId } = await params;

    try {
        const room = await findRoomByKey(auth.db, roomId);
        if (!room) {
            return NextResponse.json({ message: 'Room not found' }, { status: 404 });
        }

        const activeRoom = await autoCloseExpiredRoom<RoomDocument>(auth.db, room as RoomDocument);

        const body = await request.json();
        const selectedIds = normalizeSelection(body?.selectedCandidateIds);
        if (selectedIds.length === 0) {
            return NextResponse.json({ message: 'At least one candidate is required' }, { status: 400 });
        }

        const roomStatus = String((activeRoom as { status?: unknown }).status || '').toLowerCase();
        if (roomStatus !== 'open') {
            return NextResponse.json({ message: 'Room is not open' }, { status: 403 });
        }

        const roomObjectId = activeRoom._id?.toString?.() || roomId;
        const votes = auth.db.collection<VoteDoc>('votes');

        await votes.deleteMany({
            roomId: { $in: getVoteRoomKeys(activeRoom, roomId) },
            userId: auth.payload.id,
        });

        await votes.insertOne({
            roomId: roomObjectId,
            roomCode: activeRoom.roomCode || roomId,
            userId: auth.payload.id,
            selectedIds,
            votedAt: new Date(),
        });

        return NextResponse.json({
            success: true,
            roomId: roomObjectId,
            selectedIds,
        });
    } catch (error) {
        console.error('Vote submission error:', error);
        return NextResponse.json({ message: 'Failed to submit vote' }, { status: 500 });
    }
}
