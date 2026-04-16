import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";

import {
  deleteUser,
  getUserById,
  getUserByStudentId,
  updateUser,
} from "@/lib/firestoreData";
import { getAuthContext } from "@/lib/serverAuth";
import { normalizeText, serializeManagedUser } from "@/lib/userAuth";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> },
) {
  const auth = await getAuthContext(request, "admin");
  if (!auth) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { userId } = await params;
  const user = await getUserById(userId);
  if (!user) {
    return NextResponse.json({ message: "User not found" }, { status: 404 });
  }

  return NextResponse.json(serializeManagedUser(user));
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> },
) {
  const auth = await getAuthContext(request, "admin");
  if (!auth) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { userId } = await params;

  try {
    const body = await request.json();
    const currentUser = await getUserById(userId);

    if (!currentUser) {
      return NextResponse.json({ message: "User not found" }, { status: 404 });
    }

    const updates: Record<string, unknown> = {};

    if (typeof body?.fullName === "string" || typeof body?.name === "string") {
      const fullName = normalizeText(body.fullName ?? body.name);
      if (!fullName) {
        return NextResponse.json({ message: "Name is required" }, { status: 400 });
      }
      updates.fullName = fullName;
    }

    if (typeof body?.avatar === "string") {
      updates.avatar = normalizeText(body.avatar);
    }

    const studentIdValue =
      typeof body?.studentId === "string" ? normalizeText(body.studentId) : "";
    if (studentIdValue) {
      const existingStudentId = await getUserByStudentId(studentIdValue);
      if (existingStudentId && existingStudentId.id !== userId) {
        return NextResponse.json(
          { message: "Student ID already exists" },
          { status: 409 },
        );
      }
      updates.studentId = studentIdValue;
      if (studentIdValue !== currentUser.studentId) {
        updates.password = await bcrypt.hash(studentIdValue, 10);
        updates.mustChangePassword = false;
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { message: "No updates provided" },
        { status: 400 },
      );
    }

    const updated = await updateUser(userId, updates);
    if (!updated) {
      return NextResponse.json({ message: "User not found" }, { status: 404 });
    }

    return NextResponse.json(serializeManagedUser(updated));
  } catch (error) {
    console.error("Update user error:", error);
    return NextResponse.json(
      { message: "Failed to update user" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> },
) {
  const auth = await getAuthContext(request, "admin");
  if (!auth) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { userId } = await params;
  const user = await getUserById(userId);
  if (!user) {
    return NextResponse.json({ message: "User not found" }, { status: 404 });
  }

  await deleteUser(userId);
  return NextResponse.json({ success: true });
}
