import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";

import { getAdminById, updateAdmin } from "@/lib/firestoreData";
import { getAuthContext } from "@/lib/serverAuth";

export async function PATCH(request: NextRequest) {
  const auth = await getAuthContext(request, "admin");
  if (!auth?.payload.id) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const adminId = String(auth.payload.id || "").trim();
  if (!adminId) {
    return NextResponse.json({ message: "Invalid admin session" }, { status: 400 });
  }

  const updates: Record<string, unknown> = {};

  if (typeof body?.fullName === "string") {
    updates.fullName = body.fullName.trim();
  }

  if (typeof body?.password === "string" && body.password.trim()) {
    updates.password = await bcrypt.hash(body.password.trim(), 10);
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ message: "No updates provided" }, { status: 400 });
  }

  const existingAdmin = await getAdminById(adminId);
  if (!existingAdmin) {
    return NextResponse.json({ message: "Admin not found" }, { status: 404 });
  }

  const updatedAdmin = await updateAdmin(adminId, updates);
  if (!updatedAdmin) {
    return NextResponse.json({ message: "Admin not found" }, { status: 404 });
  }

  return NextResponse.json({
    id: updatedAdmin.id,
    username: updatedAdmin.username,
    fullName: updatedAdmin.fullName,
    role: "admin",
  });
}
