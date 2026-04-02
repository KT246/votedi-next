import jwt from 'jsonwebtoken';
import { ObjectId, type Db } from 'mongodb';
import { connectToDatabase } from './mongodb';
import type { UserDocument } from './userAuth';

const JWT_SECRET = process.env.JWT_SECRET || 'vote-next-secret-key';

export type AuthPayload = {
    id?: string;
    username?: string;
    role?: string;
    createdByAdminId?: string;
};

export type AuthContext = {
    db: Db;
    payload: AuthPayload;
};

function readBearerToken(authorization: string | null): string {
    if (!authorization) return '';
    const match = authorization.match(/^Bearer\s+(.+)$/i);
    return match?.[1] || '';
}

export function readDeviceId(request: Request): string {
    return String(request.headers.get('x-device-id') || '').trim();
}

export async function getAuthContext(request: Request, requiredRole?: 'admin' | 'user'): Promise<AuthContext | null> {
    const token = readBearerToken(request.headers.get('authorization'));
    if (!token) return null;

    try {
        const payload = jwt.verify(token, JWT_SECRET) as AuthPayload;
        if (requiredRole && payload.role !== requiredRole) {
            return null;
        }

        const { db } = await connectToDatabase();
        if (payload.role === 'user') {
            const userId = String(payload.id || '').trim();
            const deviceId = readDeviceId(request);
            if (!userId || !ObjectId.isValid(userId) || !deviceId) {
                return null;
            }

            const user = await db.collection<UserDocument>('users').findOne({ _id: new ObjectId(userId) });
            if (!user) {
                return null;
            }

            const activeDeviceId = String(user.activeDeviceId || '').trim();
            if (activeDeviceId && activeDeviceId !== deviceId) {
                return null;
            }
        }

        return { db, payload };
    } catch {
        return null;
    }
}
