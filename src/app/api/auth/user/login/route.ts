import { NextRequest, NextResponse } from "next/server";

import {
  getUserByStudentId,
} from "@/lib/firestoreData";
import {
  normalizeText,
  serializeUser,
  signUserToken,
} from "@/lib/userAuth";

export async function POST(request: NextRequest) {
  try {
    const { studentId } = await request.json();
    const normalizedStudentId = normalizeText(studentId);

    if (!normalizedStudentId) {
      return NextResponse.json(
        { message: "Student ID is required" },
        { status: 400 },
      );
    }

    const user = await getUserByStudentId(normalizedStudentId);
    if (!user) {
      return NextResponse.json(
        { message: "Student ID is not valid" },
        { status: 401 },
      );
    }

    return NextResponse.json({
      accessToken: signUserToken(user),
      user: serializeUser(user),
    });
  } catch (error) {
    console.error("User login error:", error);
    return NextResponse.json({ message: "Failed to login" }, { status: 500 });
  }
}
