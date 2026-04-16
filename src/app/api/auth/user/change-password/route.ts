import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";

import { getUserById, updateUser } from "@/lib/firestoreData";
import { getAuthContext } from "@/lib/serverAuth";
import { serializeUser, signUserToken } from "@/lib/userAuth";

export async function POST(request: NextRequest) {
  const auth = await getAuthContext(request, "user");
  if (!auth?.payload.id) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  try {
    const { currentPassword, newPassword } = await request.json();

    if (typeof currentPassword !== "string" || typeof newPassword !== "string") {
      return NextResponse.json({ message: "Invalid payload" }, { status: 400 });
    }

    const current = currentPassword.trim();
    const nextPassword = newPassword.trim();

    if (!current || !nextPassword) {
      return NextResponse.json(
        { message: "Current password and new password are required" },
        { status: 400 },
      );
    }

    if (nextPassword.length < 6) {
      return NextResponse.json(
        { message: "New password must be at least 6 characters" },
        { status: 400 },
      );
    }

    const user = await getUserById(auth.payload.id);
    if (!user) {
      return NextResponse.json({ message: "User not found" }, { status: 404 });
    }

    const isValidPassword = await bcrypt.compare(current, user.password);
    if (!isValidPassword) {
      return NextResponse.json(
        { message: "Current password is incorrect" },
        { status: 400 },
      );
    }

    if (current === nextPassword) {
      return NextResponse.json(
        { message: "New password must be different from current password" },
        { status: 400 },
      );
    }

    const hashedPassword = await bcrypt.hash(nextPassword, 10);
    const updatedUser = await updateUser(auth.payload.id, {
      password: hashedPassword,
      mustChangePassword: false,
    });

    if (!updatedUser) {
      return NextResponse.json({ message: "User not found" }, { status: 404 });
    }

    return NextResponse.json({
      accessToken: signUserToken(updatedUser),
      user: serializeUser(updatedUser),
    });
  } catch (error) {
    console.error("User change password error:", error);
    return NextResponse.json(
      { message: "Failed to change password" },
      { status: 500 },
    );
  }
}
