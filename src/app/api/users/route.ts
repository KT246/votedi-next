import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';

import { getAuthContext } from '@/lib/serverAuth';
import { normalizeText, serializeUser, type UserDocument } from '@/lib/userAuth';

function normalizeUsername(value: unknown): string {
    return normalizeText(value).toLowerCase();
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

    return NextResponse.json(users.map(serializeUser));
}

export async function POST(request: NextRequest) {
    const auth = await getAuthContext(request, 'admin');
    if (!auth) {
        return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    try {
        const body = await request.json();
        const username = normalizeUsername(body?.username);
        const fullName = normalizeText(body?.fullName ?? body?.name);
        const studentId = normalizeText(body?.studentId);

        if (!username || !fullName || !studentId) {
            return NextResponse.json({ message: 'Username, name and student ID are required' }, { status: 400 });
        }

        const users = auth.db.collection<UserDocument>('users');
        const existingUsername = await users.findOne({ username });
        if (existingUsername) {
            return NextResponse.json({ message: 'Username already exists' }, { status: 409 });
        }

        const existingStudentId = await users.findOne({ studentId });
        if (existingStudentId) {
            return NextResponse.json({ message: 'Student ID already exists' }, { status: 409 });
        }

        const now = new Date();
        const result = await users.insertOne({
            username,
            fullName,
            studentId,
            password: await bcrypt.hash(studentId, 10),
            mustChangePassword: true,
            createdByAdminId: auth.payload.id || '',
            role: 'user',
            createdAt: now,
            updatedAt: now,
        });

        const created = await users.findOne({ _id: result.insertedId });
        return NextResponse.json(created ? serializeUser(created) : null, { status: 201 });
    } catch (error) {
        console.error('Create user error:', error);
        return NextResponse.json({ message: 'Failed to create user' }, { status: 500 });
    }
}
