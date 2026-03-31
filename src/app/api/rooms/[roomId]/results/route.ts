import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';

import { getAuthContext } from '@/lib/serverAuth';
import { autoCloseExpiredRoom, getVoteRoomKeys } from '@/lib/roomLifecycle';

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

type VoteDoc = {
    roomId?: string;
    candidateId?: string;
    selectedIds?: string[];
};

async function findRoomByKey(
    db: { collection: (name: string) => { findOne: (query: Record<string, unknown>) => Promise<{ _id?: { toString?: () => string } } | null> } },
    roomKey: string,
) {
    const directByStringId = await db.collection('rooms').findOne({ _id: roomKey });
    if (directByStringId) return directByStringId;

    if (roomKey && roomKey.length >= 12) {
        const { ObjectId } = await import('mongodb');
        if (ObjectId.isValid(roomKey) && String(new ObjectId(roomKey)) === roomKey) {
            const byObjectId = await db.collection('rooms').findOne({ _id: new ObjectId(roomKey) });
            if (byObjectId) return byObjectId;
        }
    }

    return db.collection('rooms').findOne({ roomCode: roomKey });
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ roomId: string }> }) {
    const auth = await getAuthContext(request);
    if (!auth) {
        return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const { roomId } = await params;
    const room = await findRoomByKey(auth.db, roomId);
    if (!room) {
        return NextResponse.json({ message: 'Room not found' }, { status: 404 });
    }

    const activeRoom = await autoCloseExpiredRoom<RoomDocument>(auth.db, room as RoomDocument);

    const voteDocs = await auth.db.collection<VoteDoc>('votes').find({ roomId: { $in: getVoteRoomKeys(activeRoom, roomId) } }).toArray();
    const counts = new Map<string, number>();

    for (const vote of voteDocs) {
        if (Array.isArray(vote.selectedIds) && vote.selectedIds.length > 0) {
            for (const candidateId of vote.selectedIds) {
                counts.set(candidateId, (counts.get(candidateId) || 0) + 1);
            }
            continue;
        }

        if (vote.candidateId) {
            counts.set(vote.candidateId, (counts.get(vote.candidateId) || 0) + 1);
        }
    }

    const results = Array.from(counts.entries())
        .map(([candidateId, voteCount]) => ({ candidateId, voteCount }))
        .sort((a, b) => b.voteCount - a.voteCount);

    return NextResponse.json(results);
}
