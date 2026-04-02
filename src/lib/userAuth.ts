import jwt from 'jsonwebtoken';
import type { ObjectId } from 'mongodb';

const JWT_SECRET = process.env.JWT_SECRET || 'vote-next-secret-key';

export type UserDocument = {
    _id?: ObjectId;
    username: string;
    fullName: string;
    studentId: string;
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
        id: user._id?.toString() || '',
        username: user.username,
        fullName: user.fullName,
        role: 'user',
        mustChangePassword: Boolean(user.mustChangePassword),
        createdByAdminId: user.createdByAdminId || '',
        createdAt: user.createdAt?.toISOString?.() || '',
        updatedAt: user.updatedAt?.toISOString?.() || '',
    };
}

export function serializeManagedUser(user: UserDocument) {
    return {
        id: user._id?.toString() || '',
        username: user.username,
        fullName: user.fullName,
        studentId: user.studentId,
        role: 'user',
        mustChangePassword: Boolean(user.mustChangePassword),
        createdByAdminId: user.createdByAdminId || '',
        createdAt: user.createdAt?.toISOString?.() || '',
        updatedAt: user.updatedAt?.toISOString?.() || '',
    };
}

export function signUserToken(user: UserDocument) {
    return jwt.sign(
        {
            id: user._id?.toString() || '',
            username: user.username,
            role: 'user',
            createdByAdminId: user.createdByAdminId || '',
        },
        JWT_SECRET,
        { expiresIn: '24h' },
    );
}
