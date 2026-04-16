import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";

import {
  createUser,
  getUserByStudentId,
  listUsers,
} from "@/lib/firestoreData";
import { getAuthContext } from "@/lib/serverAuth";
import { normalizeText, serializeManagedUser } from "@/lib/userAuth";

function normalizeAvatar(value: unknown): string {
  return normalizeText(value);
}

export async function GET(request: NextRequest) {
  const auth = await getAuthContext(request, "admin");
  if (!auth) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const users = await listUsers();
  return NextResponse.json(users.map(serializeManagedUser));
}

export async function POST(request: NextRequest) {
  const auth = await getAuthContext(request, "admin");
  if (!auth) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const fullName = normalizeText(body?.fullName ?? body?.name);
    const studentId = normalizeText(body?.studentId);
    const avatar = normalizeAvatar(body?.avatar);

    if (!fullName || !studentId) {
      return NextResponse.json(
        { message: "Full name and student ID are required" },
        { status: 400 },
      );
    }

    const existingStudentId = await getUserByStudentId(studentId);
    if (existingStudentId) {
      return NextResponse.json(
        { message: "Student ID already exists" },
        { status: 409 },
      );
    }

    const now = new Date();
    const created = await createUser({
      fullName,
      studentId,
      avatar,
      password: await bcrypt.hash(studentId, 10),
      mustChangePassword: false,
      createdByAdminId: auth.payload.id || "",
      role: "user",
      createdAt: now,
      updatedAt: now,
    });

    return NextResponse.json(serializeManagedUser(created), { status: 201 });
  } catch (error) {
    console.error("Create user error:", error);
    return NextResponse.json(
      { message: "Failed to create user" },
      { status: 500 },
    );
  }
}
