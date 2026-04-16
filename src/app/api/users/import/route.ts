import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';

import { getAuthContext } from '@/lib/serverAuth';
import { normalizeText, serializeManagedUser, type UserDocument } from '@/lib/userAuth';

type ImportRow = {
    fullName?: unknown;
    name?: unknown;
    studentId?: unknown;
    avatar?: unknown;
};

export async function POST(request: NextRequest) {
    const auth = await getAuthContext(request, 'admin');
    if (!auth) {
        return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    try {
        const body = await request.json();
        const rows = Array.isArray(body?.rows) ? (body.rows as ImportRow[]) : [];

        if (rows.length === 0) {
            return NextResponse.json({ message: 'No rows provided' }, { status: 400 });
        }

        const users = auth.db.collection<UserDocument>('users');
        const existingUsers = await users.find({}).toArray();
        const existingStudentIdSet = new Set(existingUsers.map((item) => String(item.studentId || '')));
        const batchStudentIdSet = new Set<string>();

        const created: UserDocument[] = [];
        const skipped: Array<{ row: number; reason: string }> = [];
        const now = new Date();

        for (let index = 0; index < rows.length; index += 1) {
            const row = rows[index] || {};
            const fullName = normalizeText(row.fullName ?? row.name);
            const studentId = normalizeText(row.studentId);
            const avatar = normalizeText(row.avatar);

            if (!fullName || !studentId) {
                skipped.push({ row: index + 1, reason: 'Missing full name or student ID' });
                continue;
            }

            if (existingStudentIdSet.has(studentId) || batchStudentIdSet.has(studentId)) {
                skipped.push({ row: index + 1, reason: `Duplicate student ID: ${studentId}` });
                continue;
            }

            batchStudentIdSet.add(studentId);

            created.push({
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
        }

        if (created.length > 0) {
            const result = await users.insertMany(created);
            const insertedIds = Object.values(result.insertedIds);
            const insertedUsers = await users.find({ _id: { $in: insertedIds } }).toArray();
            return NextResponse.json({
                created: insertedUsers.map(serializeManagedUser),
                skipped,
            });
        }

        return NextResponse.json({
            created: [],
            skipped,
        });
    } catch (error) {
        console.error('Import users error:', error);
        return NextResponse.json({ message: 'Failed to import users' }, { status: 500 });
    }
}
