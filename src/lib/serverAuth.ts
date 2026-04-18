import jwt from 'jsonwebtoken';
import { getAdminDb } from './firebaseAdmin';
import { getUserById } from './firestoreData';

const JWT_SECRET = process.env.JWT_SECRET || 'vote-next-secret-key';

export type AuthPayload = {
    id?: string;
    username?: string;
    studentId?: string;
    role?: string;
    createdByAdminId?: string;
};

export type AuthContext = {
    db: ReturnType<typeof getAdminDb>;
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

        const db = getAdminDb();
        if (payload.role === 'user') {
            const userId = String(payload.id || '').trim();
            if (!userId) {
                return null;
            }

            const user = await getUserById(userId);
            if (!user) {
                return null;
            }
        }

        return { db, payload };
    } catch {
        return null;
    }
}
