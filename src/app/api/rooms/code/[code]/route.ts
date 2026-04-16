import { NextRequest, NextResponse } from "next/server";

import {
  getRoomByCode,
  getVoteByRoomAndUser,
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
    candidates: room.candidates || [],
  };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> },
) {
  const auth = await getAuthContext(request);
  if (!auth) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { code } = await params;
  const room = await getRoomByCode(code);
  if (!room) {
    return NextResponse.json({ message: "Room not found" }, { status: 404 });
  }

  const activeRoom = await autoCloseExpiredRoom(room);

  let myVote: { selectedIds: string[]; votedAt: string } | null = null;
  if (auth.payload.id) {
    const vote = await getVoteByRoomAndUser(activeRoom.id, auth.payload.id);
    if (vote) {
      myVote = {
        selectedIds: vote.selectedIds,
        votedAt: vote.votedAt.toISOString(),
      };
    }
  }

  return NextResponse.json({
    ...serializeRoom(activeRoom),
    myVote,
  });
}
