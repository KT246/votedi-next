import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';

import { getAuthContext } from '@/lib/serverAuth';
import { autoCloseExpiredRoom, getVoteRoomKeys } from '@/lib/roomLifecycle';

type RoomDocument = {
    _id?: ObjectId;
    roomCode?: string;
    allowedUsers?: string[];
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
    userId?: string;
    votedAt?: Date | string;
};

type UserDoc = {
    _id?: ObjectId;
    username?: string;
    fullName?: string;
};

function normalizeString(value: unknown): string {
    return typeof value === 'string' ? value.trim() : String(value || '').trim();
}

function normalizeVoteAt(value: unknown): string | null {
    if (value instanceof Date) return value.toISOString();
    if (typeof value === 'string' && value.trim()) return value.trim();
    return null;
}

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
    const includeRows =
        auth.payload.role === 'admin' ||
        request.nextUrl.searchParams.get('includeRows') === '1';

    const { roomId } = await params;
    const room = await findRoomByKey(auth.db, roomId);
    if (!room) {
        return NextResponse.json({ message: 'Room not found' }, { status: 404 });
    }

    const activeRoom = await autoCloseExpiredRoom<RoomDocument>(auth.db, room as RoomDocument);

    const voteDocs = await auth.db.collection<VoteDoc>('votes').find({ roomId: { $in: getVoteRoomKeys(activeRoom, roomId) } }).toArray();
    const counts = new Map<string, number>();
    const voteByUserId = new Map<string, VoteDoc>();

    for (const vote of voteDocs) {
        const userId = normalizeString(vote.userId);
        if (userId && !voteByUserId.has(userId)) {
            voteByUserId.set(userId, vote);
        }

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

    const allowedUsers = Array.from(
        new Set(
            Array.isArray(activeRoom.allowedUsers)
                ? activeRoom.allowedUsers.map((value: unknown) => normalizeString(value)).filter(Boolean)
                : [],
        ),
    );

    const allowedUserSet = new Set(allowedUsers);
    const votedCount = Array.from(voteByUserId.keys()).filter((userId) => allowedUserSet.has(userId)).length;
    const notVotedCount = allowedUsers.length - votedCount;

    let rows: Array<{
        userId: string;
        username: string;
        fullName: string;
        hasVoted: boolean;
        selectedIds: string[];
        submittedAt: string | null;
    }> | undefined;

    if (includeRows) {
        const eligibleObjectIds = allowedUsers
            .filter((value) => ObjectId.isValid(value) && String(new ObjectId(value)) === value)
            .map((value) => new ObjectId(value));

        const userDocs = eligibleObjectIds.length > 0
            ? await auth.db.collection<UserDoc>('users').find({ _id: { $in: eligibleObjectIds } }).toArray()
            : [];

        const userMap = new Map(
            userDocs.map((user) => [user._id?.toString() || '', user]),
        );

        rows = allowedUsers.map((userId) => {
            const user = userMap.get(userId);
            const vote = voteByUserId.get(userId);
            return {
                userId,
                username: normalizeString(user?.username) || userId,
                fullName: normalizeString(user?.fullName) || normalizeString(user?.username) || userId,
                hasVoted: Boolean(vote),
                selectedIds: Array.isArray(vote?.selectedIds)
                    ? vote.selectedIds.map((item: unknown) => normalizeString(item)).filter(Boolean)
                    : vote?.candidateId
                        ? [normalizeString(vote.candidateId)]
                        : [],
                submittedAt: normalizeVoteAt(vote?.votedAt),
            };
        });
    }

    return NextResponse.json({
        results,
        participation: {
            eligibleCount: allowedUsers.length,
            votedCount,
            notVotedCount,
            ...(rows ? { rows } : {}),
        },
    });
}
