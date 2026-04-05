import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';

import { getAuthContext } from '@/lib/serverAuth';
import { autoCloseExpiredRoom, getVoteRoomKeys } from '@/lib/roomLifecycle';
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
        candidates: room.candidates || [],
    };
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ code: string }> }) {
    const auth = await getAuthContext(request);
    if (!auth) {
        return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const { code } = await params;
    const room = await auth.db.collection<RoomDocument>('rooms').findOne(
        { roomCode: code },
        {
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
                candidates: 1,
                ownerAdminId: 1,
                createdAt: 1,
                updatedAt: 1,
            },
        },
    );
    if (!room) {
        return NextResponse.json({ message: 'Room not found' }, { status: 404 });
    }

    const activeRoom = await autoCloseExpiredRoom<RoomDocument>(auth.db, room);

    const userId = auth.payload.id || '';
    let myVote: { selectedIds: string[]; votedAt: string } | null = null;
    if (userId) {
        const vote = await auth.db.collection('votes').findOne({
            userId,
            roomId: { $in: getVoteRoomKeys(activeRoom, code) },
        });

        if (vote) {
            const selectedIds = Array.isArray(vote.selectedIds)
                ? vote.selectedIds.map((item: unknown) => String(item).trim()).filter(Boolean)
                : vote.candidateId
                    ? [String(vote.candidateId).trim()]
                    : [];
            myVote = {
                selectedIds,
                votedAt: vote.votedAt instanceof Date ? vote.votedAt.toISOString() : String(vote.votedAt || new Date().toISOString()),
            };
        }
    }

    return NextResponse.json({
        ...serializeRoom(activeRoom),
        myVote,
    });
}
