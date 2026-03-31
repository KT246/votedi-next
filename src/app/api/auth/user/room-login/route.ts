import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';

import { getAuthContext } from '@/lib/serverAuth';
import { type UserDocument } from '@/lib/userAuth';

function normalizeCode(value: unknown): string {
    return typeof value === 'string' ? value.trim() : '';
}

function isObjectId(value: string): boolean {
    return ObjectId.isValid(value) && String(new ObjectId(value)) === value;
}

export async function POST(request: NextRequest) {
    const auth = await getAuthContext(request, 'user');
    if (!auth?.payload.id || !isObjectId(auth.payload.id)) {
        return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { roomCode } = await request.json();
        const normalizedRoomCode = normalizeCode(roomCode);
        if (!normalizedRoomCode) {
            return NextResponse.json({ message: 'Room code is required' }, { status: 400 });
        }

        const users = auth.db.collection<UserDocument>('users');
        const user = await users.findOne({ _id: new ObjectId(auth.payload.id) });
        if (!user) {
            return NextResponse.json({ message: 'User not found' }, { status: 404 });
        }

        const room = await auth.db.collection('rooms').findOne({ roomCode: normalizedRoomCode });
        if (!room) {
            return NextResponse.json({ message: 'Room not found' }, { status: 404 });
        }

        const roomStatus = String(room.status || '').toLowerCase();
        if (roomStatus !== 'open' && roomStatus !== 'pending') {
            return NextResponse.json({ message: 'Room is not available for login' }, { status: 403 });
        }

        const ownerAdminId = String(room.ownerAdminId || '');
        const createdByAdminId = String(user.createdByAdminId || '');
        const allowedUsers = Array.isArray(room.allowedUsers) ? room.allowedUsers.map((value: unknown) => String(value)) : [];

        const isAllowed =
            allowedUsers.includes(auth.payload.id) ||
            (ownerAdminId && ownerAdminId === createdByAdminId);

        if (!isAllowed) {
            return NextResponse.json({ message: 'user is not valid for this room' }, { status: 403 });
        }

        return NextResponse.json({ message: 'ok', roomCode: normalizedRoomCode });
    } catch (error) {
        console.error('User room login error:', error);
        return NextResponse.json({ message: 'Failed to login to room' }, { status: 500 });
    }
}
