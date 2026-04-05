import { NextRequest, NextResponse } from 'next/server';
import { ObjectId, type Db } from 'mongodb';

import { getAuthContext } from '@/lib/serverAuth';
import { autoCloseExpiredRoom } from '@/lib/roomLifecycle';
import { emitRoomLifecycleChanged } from '@/lib/realtimeEmitter';
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

function isObjectId(value: string): boolean {
    return ObjectId.isValid(value) && String(new ObjectId(value)) === value;
}

function normalizeString(value: unknown): string {
    return typeof value === 'string' ? value.trim() : String(value || '').trim();
}

function normalizeVoteType(value: unknown): VoteRoom['voteType'] {
    return value === 'multi' || value === 'option' ? value : 'single';
}

function normalizeStatus(value: unknown): VoteRoom['status'] {
    return value === 'draft' || value === 'pending' || value === 'open' || value === 'closed' ? value : 'draft';
}

function normalizeBio(value: unknown): string[] {
    if (Array.isArray(value)) {
        return value.map((entry) => String(entry).trim()).filter(Boolean);
    }
    if (typeof value === 'string') {
        return value.split(/;/g).map((entry) => entry.trim()).filter(Boolean);
    }
    return [];
}

function normalizeCandidates(value: unknown): Candidate[] {
    if (!Array.isArray(value)) return [];
    return value
        .map((item, index) => {
            const candidate = item as Record<string, unknown>;
            const bio = normalizeBio(candidate.bio);
            const achievements = Array.isArray(candidate.achievements)
                ? candidate.achievements.map((entry) => String(entry)).filter(Boolean)
                : bio;
            const id = normalizeString(candidate.id ?? candidate._id) || `candidate-${index + 1}`;
            return {
                id,
                name: normalizeString(candidate.name || candidate.fullName) || `Candidate ${index + 1}`,
                title: normalizeString(candidate.title),
                date: normalizeString(candidate.date),
                bio,
                shortBio: normalizeString(candidate.shortBio),
                fullProfile: normalizeString(candidate.fullProfile) || bio.join('; '),
                avatar: normalizeString(candidate.avatar),
                achievements,
                voteCount: typeof candidate.voteCount === 'number' ? candidate.voteCount : 0,
            } satisfies Candidate;
        })
        .filter((item) => item.name);
}

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
        allowedUsers: room.allowedUsers || [],
        ownerAdminId: room.ownerAdminId,
        createdAt: room.createdAt?.toISOString?.() || '',
        updatedAt: room.updatedAt?.toISOString?.() || '',
    };
}

async function generateRoomCode(db: Db): Promise<string> {
    const charset = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    for (let attempt = 0; attempt < 10; attempt += 1) {
        let code = '';
        for (let i = 0; i < 6; i += 1) {
            code += charset[Math.floor(Math.random() * charset.length)];
        }
        // eslint-disable-next-line no-await-in-loop
        const existing = await db.collection('rooms').findOne({ roomCode: code });
        if (!existing) return code;
    }
    return `R${Date.now().toString(36).toUpperCase()}`;
}

export async function GET(request: NextRequest) {
    const auth = await getAuthContext(request, 'admin');
    if (!auth) {
        return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const rooms = await auth.db
        .collection<RoomDocument>('rooms')
        .find({})
        .sort({ createdAt: -1 })
        .toArray();

    const resolvedRooms = await Promise.all(rooms.map((room) => autoCloseExpiredRoom<RoomDocument>(auth.db, room)));
    return NextResponse.json(resolvedRooms.map(serializeRoom));
}

export async function POST(request: NextRequest) {
    const auth = await getAuthContext(request, 'admin');
    if (!auth) {
        return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    try {
        const body = await request.json();
        const roomName = normalizeString(body?.roomName);
        if (!roomName) {
            return NextResponse.json({ message: 'Room name is required' }, { status: 400 });
        }

        const now = new Date();
        const room: RoomDocument = {
            roomCode: normalizeString(body?.roomCode) || (await generateRoomCode(auth.db)),
            roomName,
            description: normalizeString(body?.description),
            startTime: body?.startTime ? new Date(String(body.startTime)) : null,
            endTime: body?.endTime ? new Date(String(body.endTime)) : null,
            timeMode: body?.timeMode === 'duration' ? 'duration' : 'range',
            durationMinutes: typeof body?.durationMinutes === 'number' ? body.durationMinutes : undefined,
            voteType: normalizeVoteType(body?.voteType),
            maxSelection: Number.isFinite(Number(body?.maxSelection)) && Number(body.maxSelection) > 0 ? Number(body.maxSelection) : 1,
            status: normalizeStatus(body?.status),
            allowResultView: Boolean(body?.allowResultView),
            candidates: normalizeCandidates(body?.candidates),
            allowedUsers: Array.isArray(body?.allowedUsers) ? body.allowedUsers.map((value: unknown) => String(value)) : [],
            ownerAdminId: auth.payload.id || '',
            createdAt: now,
            updatedAt: now,
        };

        const result = await auth.db.collection('rooms').insertOne(room);
        const created = await auth.db.collection<RoomDocument>('rooms').findOne({ _id: result.insertedId });
        const serializedRoom = created
            ? serializeRoom(created)
            : serializeRoom({ ...room, _id: result.insertedId } as RoomDocument);

        await emitRoomLifecycleChanged({
            roomId: serializedRoom.id || serializedRoom.roomCode,
            status: serializedRoom.status,
            ownerAdminId: serializedRoom.ownerAdminId,
        });

        return NextResponse.json(serializedRoom, {
            status: 201,
        });
    } catch (error) {
        console.error('Create room error:', error);
        return NextResponse.json({ message: 'Failed to create room' }, { status: 500 });
    }
}
