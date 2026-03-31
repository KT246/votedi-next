import jwt from 'jsonwebtoken';
import type { Db } from 'mongodb';
import { connectToDatabase } from './mongodb';

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

export async function getAuthContext(request: Request, requiredRole?: 'admin' | 'user'): Promise<AuthContext | null> {
    const token = readBearerToken(request.headers.get('authorization'));
    if (!token) return null;

    try {
        const payload = jwt.verify(token, JWT_SECRET) as AuthPayload;
        if (requiredRole && payload.role !== requiredRole) {
            return null;
        }

        const { db } = await connectToDatabase();
        return { db, payload };
    } catch {
        return null;
    }
}

