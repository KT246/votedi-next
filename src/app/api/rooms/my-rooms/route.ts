import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';

import { getAuthContext } from '@/lib/serverAuth';
import { autoCloseExpiredRoom } from '@/lib/roomLifecycle';
import type { Candidate, VoteRoom } from '@/types';

type RoomDocument = Omit<VoteRoom, 'id' | 'startTime' | 'endTime' | 'candidates' | 'allowedUsers' | 'createdAt' | 'updatedAt'> & {
    _id?: ObjectId;
    startTime: Date | null;
    endTime: Date | null;
    ownerAdminId: string;
    candidates: Candidate[];
    allowedUsers: string[];
    createdAt: Date;
    updatedAt: Date;
};

function serializeRoom(room: RoomDocument) {
    return {
        id: room._id?.toString() || '',
        roomCode: room.roomCode,
        roomName: room.roomName,
        description: room.description,
        startTime: room.startTime,
        endTime: room.endTime,
        timeMode: room.timeMode,
        durationMinutes: room.durationMinutes,
        voteType: room.voteType,
        maxSelection: room.maxSelection,
        status: room.status,
        allowResultView: room.allowResultView,
        ownerAdminId: room.ownerAdminId,
        createdAt: room.createdAt?.toISOString?.() || '',
        updatedAt: room.updatedAt?.toISOString?.() || '',
    };
}

export async function GET(request: NextRequest) {
    const auth = await getAuthContext(request);
    if (!auth) {
        return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    let query: Record<string, unknown> = {};
    if (auth.payload.role === 'admin') {
        query = { ownerAdminId: auth.payload.id };
    } else if (auth.payload.id) {
        const user = await auth.db.collection('users').findOne({ _id: new ObjectId(auth.payload.id) });
        const ownerAdminId = user?.createdByAdminId || '';
        query = {
            $or: [
                { allowedUsers: auth.payload.id },
                ...(ownerAdminId ? [{ ownerAdminId }] : []),
            ],
        };
    }

    const rooms = await auth.db.collection<RoomDocument>('rooms')
        .find(query, {
            projection: {
                roomCode: 1,
                roomName: 1,
                description: 1,
                startTime: 1,
                endTime: 1,
                timeMode: 1,
                durationMinutes: 1,
                voteType: 1,
                maxSelection: 1,
                status: 1,
                allowResultView: 1,
                ownerAdminId: 1,
                createdAt: 1,
                updatedAt: 1,
            },
        })
        .sort({ updatedAt: -1 })
        .toArray();
    const resolved = await Promise.all(rooms.map((room) => autoCloseExpiredRoom<RoomDocument>(auth.db, room)));
    return NextResponse.json(resolved.map(serializeRoom));
}
