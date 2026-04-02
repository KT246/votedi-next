import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import bcrypt from 'bcryptjs';

import { getAuthContext } from '@/lib/serverAuth';

function isObjectId(value: string): boolean {
    return ObjectId.isValid(value) && String(new ObjectId(value)) === value;
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ adminId: string }> }) {
    const auth = await getAuthContext(request, 'admin');
    if (!auth) {
        return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const { adminId } = await params;
    const body = await request.json();

    const requestedAdminId = String(adminId || '').trim();
    const candidateAdminId = isObjectId(requestedAdminId) ? requestedAdminId : String(auth.payload.id || '').trim();

    if (!isObjectId(candidateAdminId)) {
        return NextResponse.json({ message: 'Invalid admin id' }, { status: 400 });
    }
    const updates: Record<string, unknown> = {};

    if (typeof body?.fullName === 'string') {
        updates.fullName = body.fullName.trim();
    }

    if (typeof body?.password === 'string' && body.password.trim()) {
        updates.password = await bcrypt.hash(body.password.trim(), 10);
    }

    if (Object.keys(updates).length === 0) {
        return NextResponse.json({ message: 'No updates provided' }, { status: 400 });
    }

    if (auth.payload.id !== candidateAdminId && auth.payload.username !== 'admin') {
        return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
    }

    const result = await auth.db.collection('admins').findOneAndUpdate(
        { _id: new ObjectId(candidateAdminId) },
        { $set: updates },
        { returnDocument: 'after' },
    );

    if (!result?.value) {
        return NextResponse.json({ message: 'Admin not found' }, { status: 404 });
    }

    return NextResponse.json({
        id: result.value._id?.toString() || adminId,
        username: result.value.username,
        fullName: result.value.fullName,
        role: 'admin',
        permissions: result.value.permissions,
        createdByAdminId: result.value.createdByAdminId,
    });
}
