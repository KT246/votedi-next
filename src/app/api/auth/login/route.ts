import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'vote-next-secret-key';

export async function POST(request: NextRequest) {
    try {
        const { username, password } = await request.json();

        if (!username || !password) {
            return NextResponse.json(
                { message: 'ກະລຸນາປ້ອນຊື່ຜູ້ໃຊ້ແລະລະຫັດຜ່ານ' },
                { status: 400 }
            );
        }

        const { db } = await connectToDatabase();
        const admin = await db.collection('admins').findOne({ username });

        if (!admin) {
            return NextResponse.json(
                { message: 'ຂໍ້ມູນບໍ່ຖືກຕ້ອງ ຫຼື ເຂົ້າລະບົບບໍ່ສຳເລັດ' },
                { status: 401 }
            );
        }

        const isValidPassword = await bcrypt.compare(password, admin.password);

        if (!isValidPassword) {
            return NextResponse.json(
                { message: 'ຂໍ້ມູນບໍ່ຖືກຕ້ອງ ຫຼື ເຂົ້າລະບົບບໍ່ສຳເລັດ' },
                { status: 401 }
            );
        }

        const token = jwt.sign(
            {
                id: admin._id.toString(),
                username: admin.username,
                role: 'admin',
            },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        return NextResponse.json({
            accessToken: token,
            user: {
                id: admin._id.toString(),
                username: admin.username,
                fullName: admin.fullName,
                role: 'admin',
                permissions: admin.permissions,
                createdByAdminId: admin.createdByAdminId,
            },
        });
    } catch (error) {
        console.error('Login error:', error);
        return NextResponse.json(
            { message: 'ເກີດຂໍ້ຜິດພາດ' },
            { status: 500 }
        );
    }
}
