import { NextRequest, NextResponse } from "next/server";

import { clearUserDeviceBinding } from "@/lib/firestoreData";
import { getAuthContext, readDeviceId } from "@/lib/serverAuth";

export async function POST(request: NextRequest) {
  const auth = await getAuthContext(request);
  if (auth?.payload.role === "user") {
    const userId = String(auth.payload.id || "").trim();
    const deviceId = readDeviceId(request);

    if (userId && deviceId) {
      await clearUserDeviceBinding(userId, deviceId);
    }
  }

  return NextResponse.json({ success: true });
}
