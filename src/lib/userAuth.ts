import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'vote-next-secret-key';

export type UserDocument = {
    id?: string;
    fullName: string;
    studentId: string;
    avatar?: string;
    password: string;
    mustChangePassword?: boolean;
    activeDeviceId?: string;
    activeDeviceBoundAt?: Date;
    createdByAdminId?: string;
    role?: 'user';
    createdAt?: Date;
    updatedAt?: Date;
};

export function normalizeText(value: unknown): string {
    return typeof value === 'string' ? value.trim() : String(value || '').trim();
}

export function serializeUser(user: UserDocument) {
    return {
        id: user.id || '',
        fullName: user.fullName,
        studentId: user.studentId,
        avatar: user.avatar || '',
        role: 'user',
        createdByAdminId: user.createdByAdminId || '',
        createdAt: user.createdAt?.toISOString?.() || '',
        updatedAt: user.updatedAt?.toISOString?.() || '',
    };
}

export function serializeManagedUser(user: UserDocument) {
    return {
        id: user.id || '',
        fullName: user.fullName,
        studentId: user.studentId,
        avatar: user.avatar || '',
        role: 'user',
        createdByAdminId: user.createdByAdminId || '',
        createdAt: user.createdAt?.toISOString?.() || '',
        updatedAt: user.updatedAt?.toISOString?.() || '',
    };
}

export function signUserToken(user: UserDocument) {
    return jwt.sign(
        {
            id: user.id || '',
            studentId: user.studentId,
            role: 'user',
            createdByAdminId: user.createdByAdminId || '',
        },
        JWT_SECRET,
        { expiresIn: '24h' },
    );
}
