import { ObjectId } from 'mongodb';
import { NextRequest, NextResponse } from 'next/server';

import { getAuthContext, readDeviceId } from '@/lib/serverAuth';
import type { UserDocument } from '@/lib/userAuth';

export async function POST(request: NextRequest) {
    const auth = await getAuthContext(request);
    if (auth?.payload.role === 'user') {
        const userId = String(auth.payload.id || '').trim();
        const deviceId = readDeviceId(request);

        if (userId && ObjectId.isValid(userId) && deviceId) {
            await auth.db.collection<UserDocument>('users').updateOne(
                {
                    _id: new ObjectId(userId),
                    activeDeviceId: deviceId,
                },
                {
                    $unset: {
                        activeDeviceId: '',
                        activeDeviceBoundAt: '',
                    },
                    $set: {
                        updatedAt: new Date(),
                    },
                },
            );
        }
    }

    return NextResponse.json({ success: true });
}
