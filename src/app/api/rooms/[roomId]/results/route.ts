import { NextRequest, NextResponse } from "next/server";

import {
  getRoomResultsByRoomId,
  getRoomByKey,
  listUsersByIds,
  listVotesByRoomId,
} from "@/lib/firestoreData";
import { getAuthContext } from "@/lib/serverAuth";
import { autoCloseExpiredRoom } from "@/lib/roomLifecycle";

function normalizeString(value: unknown): string {
  return typeof value === "string" ? value.trim() : String(value || "").trim();
}

function normalizeVoteAt(value: unknown): string | null {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string" && value.trim()) return value.trim();
  return null;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> },
) {
  const auth = await getAuthContext(request);
  if (!auth) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }
  const includeRows =
    auth.payload.role === "admin" &&
    request.nextUrl.searchParams.get("includeRows") === "1";

  const { roomId } = await params;
  const room = await getRoomByKey(roomId);
  if (!room) {
    return NextResponse.json({ message: "Room not found" }, { status: 404 });
  }

  const activeRoom = await autoCloseExpiredRoom(room);
  const allowedUsers = Array.from(new Set(activeRoom.allowedUsers.filter(Boolean)));
  const roomResults = await getRoomResultsByRoomId(activeRoom.id);

  let voteDocs: Awaited<ReturnType<typeof listVotesByRoomId>> = [];
  const voteByUserId = new Map<string, (typeof voteDocs)[number]>();
  if (includeRows || !roomResults) {
    voteDocs = await listVotesByRoomId(activeRoom.id);

    for (const vote of voteDocs) {
      const userId = normalizeString(vote.userId);
      if (userId && !voteByUserId.has(userId)) {
        voteByUserId.set(userId, vote);
      }
    }
  }

  const counts = roomResults?.resultCounts
    ? new Map<string, number>(Object.entries(roomResults.resultCounts))
    : new Map<string, number>();

  if (!roomResults) {
    for (const vote of voteDocs) {
      for (const candidateId of vote.selectedIds) {
        counts.set(candidateId, (counts.get(candidateId) || 0) + 1);
      }
    }
  }

  const results = Array.from(counts.entries())
    .map(([candidateId, voteCount]) => ({ candidateId, voteCount }))
    .sort((a, b) => b.voteCount - a.voteCount);

  const allowedUserSet = new Set(allowedUsers);
  const votedCount = roomResults
    ? roomResults.votedCount
    : Array.from(voteByUserId.keys()).filter((userId) => allowedUserSet.has(userId)).length;
  const eligibleCount = roomResults?.eligibleCount || allowedUsers.length;
  const notVotedCount = roomResults
    ? roomResults.notVotedCount
    : Math.max(allowedUsers.length - votedCount, 0);

  let rows:
    | Array<{
        userId: string;
        studentId: string;
        fullName: string;
        hasVoted: boolean;
        selectedIds: string[];
        submittedAt: string | null;
      }>
    | undefined;

  if (includeRows) {
    const userDocs = await listUsersByIds(allowedUsers);
    const userMap = new Map(userDocs.map((user) => [user.id || "", user]));

    rows = allowedUsers.map((userId) => {
      const user = userMap.get(userId);
      const vote = voteByUserId.get(userId);
      return {
        userId,
        studentId: normalizeString(user?.studentId) || userId,
        fullName:
          normalizeString(user?.fullName) ||
          normalizeString(user?.studentId) ||
          userId,
        hasVoted: Boolean(vote),
        selectedIds: vote?.selectedIds || [],
        submittedAt: normalizeVoteAt(vote?.votedAt),
      };
    });
  }

  return NextResponse.json({
    results,
    participation: {
      eligibleCount,
      votedCount,
      notVotedCount,
      ...(rows ? { rows } : {}),
    },
  });
}
