import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";

import { connectToDatabase } from "@/lib/mongodb";
import {
  normalizeText,
  serializeUser,
  signUserToken,
  type UserDocument,
} from "@/lib/userAuth";
import { readDeviceId } from "@/lib/serverAuth";

const deviceConflictTracker = new Map<
  string,
  { count: number; lastAttempt: number; blockedUntil: number }
>();

const MAX_CONFLICT_ATTEMPTS = 5;
const BLOCK_DURATION_MS = 60 * 1000;
const RESET_WINDOW_MS = 60 * 1000;

function checkDeviceConflictRateLimit(studentId: string): {
  allowed: boolean;
  remainingTime?: number;
} {
  const now = Date.now();
  const key = studentId.toLowerCase();

  if (Math.random() < 0.01) {
    for (const [trackerKey, trackerValue] of deviceConflictTracker.entries()) {
      if (now - trackerValue.lastAttempt > RESET_WINDOW_MS * 2) {
        deviceConflictTracker.delete(trackerKey);
      }
    }
  }

  const record = deviceConflictTracker.get(key);

  if (!record) {
    deviceConflictTracker.set(key, {
      count: 0,
      lastAttempt: now,
      blockedUntil: 0,
    });
    return { allowed: true };
  }

  if (record.blockedUntil > now) {
    return { allowed: false, remainingTime: record.blockedUntil - now };
  }

  if (record.blockedUntil > 0 && record.blockedUntil <= now) {
    record.count = 0;
    record.blockedUntil = 0;
  }

  if (now - record.lastAttempt > RESET_WINDOW_MS) {
    record.count = 0;
  }

  record.count += 1;
  record.lastAttempt = now;

  if (record.count >= MAX_CONFLICT_ATTEMPTS) {
    record.blockedUntil = now + BLOCK_DURATION_MS;
    return { allowed: false, remainingTime: BLOCK_DURATION_MS };
  }

  return { allowed: true };
}

export async function POST(request: NextRequest) {
  try {
    const { studentId } = await request.json();
    const normalizedStudentId = normalizeText(studentId);
    const deviceId = readDeviceId(request);

    if (!normalizedStudentId || !deviceId) {
      return NextResponse.json(
        { message: "Student ID and device ID are required" },
        { status: 400 },
      );
    }

    const { db } = await connectToDatabase();
    const users = db.collection<UserDocument>("users");
    const user = await users.findOne({ studentId: normalizedStudentId });

    if (!user) {
      return NextResponse.json(
        { message: "Student ID is not valid" },
        { status: 401 },
      );
    }

    const activeDeviceId = String(user.activeDeviceId || "").trim();
    if (activeDeviceId && activeDeviceId !== deviceId) {
      const rateLimitResult =
        checkDeviceConflictRateLimit(normalizedStudentId);
      if (!rateLimitResult.allowed) {
        const remainingSeconds = Math.ceil(
          (rateLimitResult.remainingTime || 0) / 1000,
        );
        return NextResponse.json(
          {
            message: `Too many device conflict attempts. Try again in ${remainingSeconds} seconds.`,
          },
          { status: 429 },
        );
      }

      return NextResponse.json(
        {
          message: "Account is active on another device. Please logout there first.",
        },
        { status: 409 },
      );
    }

    const userId = user._id ? new ObjectId(user._id) : null;
    if (!userId) {
      return NextResponse.json({ message: "User not found" }, { status: 404 });
    }

    const bindResult = await users.updateOne(
      {
        _id: userId,
        $or: [
          { activeDeviceId: { $exists: false } },
          { activeDeviceId: "" },
          { activeDeviceId: deviceId },
        ],
      },
      {
        $set: {
          activeDeviceId: deviceId,
          activeDeviceBoundAt: new Date(),
          updatedAt: new Date(),
        },
      },
    );

    if (bindResult.matchedCount === 0) {
      return NextResponse.json(
        {
          message: "Account is active on another device. Please logout there first.",
        },
        { status: 409 },
      );
    }

    deviceConflictTracker.delete(normalizedStudentId.toLowerCase());

    return NextResponse.json({
      accessToken: signUserToken(user),
      user: serializeUser(user),
    });
  } catch (error) {
    console.error("User login error:", error);
    return NextResponse.json({ message: "Failed to login" }, { status: 500 });
  }
}
