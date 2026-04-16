import { NextRequest, NextResponse } from "next/server";

import {
  submitVote,
} from "@/lib/firestoreData";
import { getAuthContext } from "@/lib/serverAuth";
import {
  emitRoomLifecycleChanged,
  emitRoomProgressUpdated,
} from "@/lib/realtimeEmitter";

function normalizeSelection(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((entry) => String(entry).trim()).filter(Boolean);
}

function jsonError(status: number, code: string, message: string) {
  return NextResponse.json(
    {
      success: false,
      message,
      error: {
        code,
        message,
      },
    },
    { status },
  );
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> },
) {
  const auth = await getAuthContext(request, "user");
  if (!auth?.payload.id) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { roomId } = await params;

  try {
    const body = await request.json();
    const selectedIds = normalizeSelection(body?.selectedCandidateIds);
    const result = await submitVote({
      roomId,
      userId: auth.payload.id,
      selectedIds,
    });

    if (!result.ok) {
      if ("roomStatusChanged" in result && result.roomStatusChanged && "room" in result && result.room) {
        await emitRoomLifecycleChanged({
          roomId: result.room.id,
          status: result.room.status,
          ownerAdminId: result.room.ownerAdminId,
        });
      }

      return jsonError(result.status, result.code, result.message);
    }

    await Promise.allSettled([
      emitRoomProgressUpdated({
        roomId: result.room.id,
        totalVotes: result.results.totalVotes,
        totalVoters: result.results.eligibleCount,
        votedUsers: result.results.votedCount,
        pendingUsers: result.results.notVotedCount,
        lastVoterId: auth.payload.id,
        ownerAdminId: result.room.ownerAdminId || "",
      }),
    ]);

    return NextResponse.json({
      success: true,
      roomId: result.room.id,
      selectedIds,
      submittedAt: result.vote.votedAt.toISOString(),
      totals: {
        totalVotes: result.results.totalVotes,
        eligibleCount: result.results.eligibleCount,
        votedCount: result.results.votedCount,
        notVotedCount: result.results.notVotedCount,
      },
    });
  } catch (error) {
    console.error("Vote submission error:", error);
    return NextResponse.json(
      { message: "Failed to submit vote" },
      { status: 500 },
    );
  }
}
