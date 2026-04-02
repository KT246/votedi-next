import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { ObjectId } from "mongodb";

import { connectToDatabase } from "@/lib/mongodb";
import {
  normalizeText,
  serializeUser,
  signUserToken,
  type UserDocument,
} from "@/lib/userAuth";
import { readDeviceId } from "@/lib/serverAuth";

// In-memory rate limiting for device conflict warnings
// In production, consider using Redis or database
const deviceConflictTracker = new Map<
  string,
  { count: number; lastAttempt: number; blockedUntil: number }
>();

const MAX_CONFLICT_ATTEMPTS = 5;
const BLOCK_DURATION_MS = 60 * 1000; // 1 minute
const RESET_WINDOW_MS = 60 * 1000; // Reset counter after 1 minute

function checkDeviceConflictRateLimit(username: string): {
  allowed: boolean;
  remainingTime?: number;
} {
  const now = Date.now();
  const key = username.toLowerCase();

  // Clean up old entries periodically (every 100 calls)
  if (Math.random() < 0.01) {
    // 1% chance
    for (const [k, v] of deviceConflictTracker.entries()) {
      if (now - v.lastAttempt > RESET_WINDOW_MS * 2) {
        deviceConflictTracker.delete(k);
      }
    }
  }

  const record = deviceConflictTracker.get(key);

  if (!record) {
    // First attempt
    deviceConflictTracker.set(key, {
      count: 0,
      lastAttempt: now,
      blockedUntil: 0,
    });
    return { allowed: true };
  }

  // Check if currently blocked
  if (record.blockedUntil > now) {
    return { allowed: false, remainingTime: record.blockedUntil - now };
  }

  // If block window just expired, reset attempt count
  if (record.blockedUntil > 0 && record.blockedUntil <= now) {
    record.count = 0;
    record.blockedUntil = 0;
  }

  // Reset counter if idle window passed since last conflict attempt
  if (now - record.lastAttempt > RESET_WINDOW_MS) {
    record.count = 0;
  }

  // Count this conflict attempt
  record.count++;
  record.lastAttempt = now;

  // Check if should block
  if (record.count >= MAX_CONFLICT_ATTEMPTS) {
    record.blockedUntil = now + BLOCK_DURATION_MS;
    return { allowed: false, remainingTime: BLOCK_DURATION_MS };
  }

  return { allowed: true };
}

export async function POST(request: NextRequest) {
  try {
    const { username, password } = await request.json();
    const normalizedUsername = normalizeText(username).toLowerCase();
    const normalizedPassword = normalizeText(password);
    const deviceId = readDeviceId(request);

    if (!normalizedUsername || !normalizedPassword || !deviceId) {
      return NextResponse.json(
        { message: "ຕ້ອງການຊື່ຜູ້ໃຊ້, ລະຫັດຜ່ານ ແລະ deviceId" },
        { status: 400 },
      );
    }

    const { db } = await connectToDatabase();
    const users = db.collection<UserDocument>("users");
    const user = await users.findOne({ username: normalizedUsername });

    if (!user) {
      return NextResponse.json(
        { message: "ຊື່ຜູ້ໃຊ້ ແລະລະຫັດຜ່ານບໍ່ຖືກຕ້ອງ" },
        { status: 401 },
      );
    }

    const isValidPassword = await bcrypt.compare(
      normalizedPassword,
      user.password,
    );
    if (!isValidPassword) {
      return NextResponse.json(
        { message: "ຊື່ຜູ້ໃຊ້ ແລະລະຫັດຜ່ານບໍ່ຖືກຕ້ອງ" },
        { status: 401 },
      );
    }

    const activeDeviceId = String(user.activeDeviceId || "").trim();
    if (activeDeviceId && activeDeviceId !== deviceId) {
      // Check rate limiting for device conflict warnings
      const rateLimitResult = checkDeviceConflictRateLimit(normalizedUsername);
      if (!rateLimitResult.allowed) {
        const remainingSeconds = Math.ceil(
          (rateLimitResult.remainingTime || 0) / 1000,
        );
        return NextResponse.json(
          {
            message: `ເພີ່ມການພະຍາຍາມກວດເຊັກອຸປະກອນເກີນໄປ. ກະລຸນາລໍຖ້າອີກ ${remainingSeconds} ວິນາທີແລ້ວຄືນມາລອງໃໝ່.`,
          },
          { status: 429 },
        );
      }

      return NextResponse.json(
        {
          message:
            "ບັນຊີນີ້ກຳລັງໃຊ້ຢູ່ໃນອຸປະກອນອື່ນ. ກະລຸນາອອກຈາກລະບົບນັ້ນກ່ອນ.",
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
          message:
            "Account is active on another device. Please logout there first.",
        },
        { status: 409 },
      );
    }

    // Reset rate limiting counter on successful login
    deviceConflictTracker.delete(normalizedUsername.toLowerCase());

    return NextResponse.json({
      accessToken: signUserToken(user),
      user: serializeUser(user),
    });
  } catch (error) {
    console.error("User login error:", error);
    return NextResponse.json({ message: "Failed to login" }, { status: 500 });
  }
}
