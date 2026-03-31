import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { ObjectId } from 'mongodb';

import { getAuthContext } from '@/lib/serverAuth';
import { normalizeText, serializeUser, type UserDocument } from '@/lib/userAuth';

function isObjectId(value: string): boolean {
    return ObjectId.isValid(value) && String(new ObjectId(value)) === value;
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ userId: string }> }) {
    const auth = await getAuthContext(request, 'admin');
    if (!auth) {
        return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const { userId } = await params;
    if (!isObjectId(userId)) {
        return NextResponse.json({ message: 'Invalid user id' }, { status: 400 });
    }

    const user = await auth.db.collection<UserDocument>('users').findOne({ _id: new ObjectId(userId) });
    if (!user) {
        return NextResponse.json({ message: 'User not found' }, { status: 404 });
    }

    return NextResponse.json(serializeUser(user));
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ userId: string }> }) {
    const auth = await getAuthContext(request, 'admin');
    if (!auth) {
        return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const { userId } = await params;
    if (!isObjectId(userId)) {
        return NextResponse.json({ message: 'Invalid user id' }, { status: 400 });
    }

    try {
        const body = await request.json();
        const users = auth.db.collection<UserDocument>('users');
        const currentUser = await users.findOne({ _id: new ObjectId(userId) });

        if (!currentUser) {
            return NextResponse.json({ message: 'User not found' }, { status: 404 });
        }

        const updates: Partial<UserDocument> & Record<string, unknown> = {
            updatedAt: new Date(),
        };

        if (typeof body?.username === 'string') {
            const username = normalizeText(body.username).toLowerCase();
            if (!username) {
                return NextResponse.json({ message: 'Username is required' }, { status: 400 });
            }
            const existingUsername = await users.findOne({ username, _id: { $ne: new ObjectId(userId) } });
            if (existingUsername) {
                return NextResponse.json({ message: 'Username already exists' }, { status: 409 });
            }
            updates.username = username;
        }

        if (typeof body?.fullName === 'string' || typeof body?.name === 'string') {
            const fullName = normalizeText(body.fullName ?? body.name);
            if (!fullName) {
                return NextResponse.json({ message: 'Name is required' }, { status: 400 });
            }
            updates.fullName = fullName;
        }

        const studentIdValue = typeof body?.studentId === 'string' ? normalizeText(body.studentId) : '';
        const shouldResetPassword = Boolean(body?.resetPasswordToStudentId);
        if (studentIdValue) {
            const existingStudentId = await users.findOne({ studentId: studentIdValue, _id: { $ne: new ObjectId(userId) } });
            if (existingStudentId) {
                return NextResponse.json({ message: 'Student ID already exists' }, { status: 409 });
            }
            updates.studentId = studentIdValue;
            if (studentIdValue !== currentUser.studentId || shouldResetPassword) {
                updates.password = await bcrypt.hash(studentIdValue, 10);
                updates.mustChangePassword = true;
            }
        }

        if (Object.keys(updates).length === 1) {
            return NextResponse.json({ message: 'No updates provided' }, { status: 400 });
        }

        await users.updateOne({ _id: new ObjectId(userId) }, { $set: updates });
        const updated = await users.findOne({ _id: new ObjectId(userId) });

        if (!updated) {
            return NextResponse.json({ message: 'User not found' }, { status: 404 });
        }

        return NextResponse.json(serializeUser(updated));
    } catch (error) {
        console.error('Update user error:', error);
        return NextResponse.json({ message: 'Failed to update user' }, { status: 500 });
    }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ userId: string }> }) {
    const auth = await getAuthContext(_request, 'admin');
    if (!auth) {
        return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const { userId } = await params;
    if (!isObjectId(userId)) {
        return NextResponse.json({ message: 'Invalid user id' }, { status: 400 });
    }

    const users = auth.db.collection<UserDocument>('users');
    const user = await users.findOne({ _id: new ObjectId(userId) });
    if (!user) {
        return NextResponse.json({ message: 'User not found' }, { status: 404 });
    }

    await users.deleteOne({ _id: new ObjectId(userId) });
    return NextResponse.json({ success: true });
}
