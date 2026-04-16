import { NextRequest, NextResponse } from "next/server";

import {
  getUserById,
  listRoomsForAdmin,
  listRoomsForUser,
  type RoomRecord,
} from "@/lib/firestoreData";
import { getAuthContext } from "@/lib/serverAuth";
import { autoCloseExpiredRoom } from "@/lib/roomLifecycle";

function serializeRoom(room: RoomRecord) {
  return {
    id: room.id,
    roomCode: room.roomCode,
    roomName: room.roomName,
    description: room.description,
    startTime: room.startTime,
    endTime: room.endTime,
    timeMode: room.timeMode,
    durationMinutes: room.durationMinutes,
    voteType: room.voteType,
    maxSelection: room.maxSelection,
    status: room.status,
    allowResultView: room.allowResultView,
    ownerAdminId: room.ownerAdminId,
    createdAt: room.createdAt?.toISOString?.() || "",
    updatedAt: room.updatedAt?.toISOString?.() || "",
  };
}

export async function GET(request: NextRequest) {
  const auth = await getAuthContext(request);
  if (!auth) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  let rooms: RoomRecord[] = [];
  if (auth.payload.role === "admin" && auth.payload.id) {
    rooms = await listRoomsForAdmin(auth.payload.id);
  } else if (auth.payload.id) {
    const user = await getUserById(auth.payload.id);
    const ownerAdminId = user?.createdByAdminId || "";
    rooms = await listRoomsForUser(auth.payload.id, ownerAdminId);
  }

  const resolved = await Promise.all(rooms.map((room) => autoCloseExpiredRoom(room)));
  return NextResponse.json(resolved.map(serializeRoom));
}
