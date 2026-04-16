import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';

import { getAuthContext } from '@/lib/serverAuth';
import { normalizeText, serializeManagedUser, type UserDocument } from '@/lib/userAuth';

function normalizeAvatar(value: unknown): string {
    return normalizeText(value);
}
export async function GET(request: NextRequest) {
    const auth = await getAuthContext(request, 'admin');
    if (!auth) {
        return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const users = await auth.db
        .collection<UserDocument>('users')
        .find({})
        .sort({ createdAt: -1 })
        .toArray();

    return NextResponse.json(users.map(serializeManagedUser));
}

export async function POST(request: NextRequest) {
    const auth = await getAuthContext(request, 'admin');
    if (!auth) {
        return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    try {
        const body = await request.json();
        const fullName = normalizeText(body?.fullName ?? body?.name);
        const studentId = normalizeText(body?.studentId);
        const avatar = normalizeAvatar(body?.avatar);

        if (!fullName || !studentId) {
            return NextResponse.json({ message: 'Full name and student ID are required' }, { status: 400 });
        }

        const users = auth.db.collection<UserDocument>('users');
        const existingStudentId = await users.findOne({ studentId });
        if (existingStudentId) {
            return NextResponse.json({ message: 'Student ID already exists' }, { status: 409 });
        }

        const now = new Date();
        const result = await users.insertOne({
            fullName,
            studentId,
            avatar,
            password: await bcrypt.hash(studentId, 10),
            mustChangePassword: false,
            createdByAdminId: auth.payload.id || '',
            role: 'user',
            createdAt: now,
            updatedAt: now,
        });

        const created = await users.findOne({ _id: result.insertedId });
        return NextResponse.json(created ? serializeManagedUser(created) : null, { status: 201 });
    } catch (error) {
        console.error('Create user error:', error);
        return NextResponse.json({ message: 'Failed to create user' }, { status: 500 });
    }
}
