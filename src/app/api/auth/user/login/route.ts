import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';

import { connectToDatabase } from '@/lib/mongodb';
import { normalizeText, serializeUser, signUserToken, type UserDocument } from '@/lib/userAuth';

export async function POST(request: NextRequest) {
    try {
        const { username, password } = await request.json();
        const normalizedUsername = normalizeText(username);
        const normalizedPassword = normalizeText(password);

        if (!normalizedUsername || !normalizedPassword) {
            return NextResponse.json({ message: 'Username and password are required' }, { status: 400 });
        }

        const { db } = await connectToDatabase();
        const user = await db.collection<UserDocument>('users').findOne({ username: normalizedUsername });

        if (!user) {
            return NextResponse.json({ message: 'Invalid username or password' }, { status: 401 });
        }

        const isValidPassword = await bcrypt.compare(normalizedPassword, user.password);
        if (!isValidPassword) {
            return NextResponse.json({ message: 'Invalid username or password' }, { status: 401 });
        }

        return NextResponse.json({
            accessToken: signUserToken(user),
            user: serializeUser(user),
        });
    } catch (error) {
        console.error('User login error:', error);
        return NextResponse.json({ message: 'Failed to login' }, { status: 500 });
    }
}
