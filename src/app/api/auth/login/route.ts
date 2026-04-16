import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

import { getAdminByUsername } from "@/lib/firestoreData";

const JWT_SECRET = process.env.JWT_SECRET || "vote-next-secret-key";

export async function POST(request: NextRequest) {
  try {
    const { username, password } = await request.json();
    const normalizedUsername = String(username || "").trim();
    const normalizedPassword = String(password || "");

    if (!normalizedUsername || !normalizedPassword) {
      return NextResponse.json(
        { message: "ກະລຸນາປ້ອນຊື່ຜູ້ໃຊ້ແລະລະຫັດຜ່ານ" },
        { status: 400 },
      );
    }

    const admin = await getAdminByUsername(normalizedUsername);
    if (!admin) {
      return NextResponse.json(
        { message: "ຂໍ້ມູນບໍ່ຖືກຕ້ອງ ຫຼື ເຂົ້າລະບົບບໍ່ສຳເລັດ" },
        { status: 401 },
      );
    }

    const isValidPassword = await bcrypt.compare(
      normalizedPassword,
      admin.password,
    );
    if (!isValidPassword) {
      return NextResponse.json(
        { message: "ຂໍ້ມູນບໍ່ຖືກຕ້ອງ ຫຼື ເຂົ້າລະບົບບໍ່ສຳເລັດ" },
        { status: 401 },
      );
    }

    const token = jwt.sign(
      {
        id: admin.id,
        username: admin.username,
        role: "admin",
      },
      JWT_SECRET,
      { expiresIn: "24h" },
    );

    return NextResponse.json({
      accessToken: token,
      user: {
        id: admin.id,
        username: admin.username,
        fullName: admin.fullName,
        role: "admin",
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json({ message: "ເກີດຂໍ້ຜິດພາດ" }, { status: 500 });
  }
}
