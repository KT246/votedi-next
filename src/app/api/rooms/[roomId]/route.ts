import { NextRequest, NextResponse } from "next/server";

import { getAuthContext } from "@/lib/serverAuth";
import { autoCloseExpiredRoom } from "@/lib/roomLifecycle";
import {
  deleteRoomResultsByRoomId,
  deleteRoom,
  deleteVotesByRoomId,
  syncRoomResultsForRoom,
  getRoomByKey,
  type RoomRecord,
  updateRoom,
} from "@/lib/firestoreData";
import {
  emitRoomLifecycleChanged,
  emitRoomResultsReset,
} from "@/lib/realtimeEmitter";
import type { Candidate, VoteRoom } from "@/types";

function normalizeString(value: unknown): string {
  return typeof value === "string" ? value.trim() : String(value || "").trim();
}

function normalizeVoteType(value: unknown): VoteRoom["voteType"] {
  return value === "multi" || value === "option" ? value : "single";
}

function normalizeStatus(value: unknown): VoteRoom["status"] {
  return value === "draft" ||
    value === "pending" ||
    value === "open" ||
    value === "closed"
    ? value
    : "draft";
}

function normalizeBio(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((entry) => String(entry).trim()).filter(Boolean);
  }
  if (typeof value === "string") {
    return value
      .split(/;/g)
      .map((entry) => entry.trim())
      .filter(Boolean);
  }
  return [];
}

function normalizeCandidates(value: unknown): Candidate[] {
  if (!Array.isArray(value)) return [];
  return value.map((item, index) => {
    const candidate = item as Record<string, unknown>;
    const bio = normalizeBio(candidate.bio);
    return {
      id:
        normalizeString(candidate.id ?? candidate._id) ||
        `candidate-${index + 1}`,
      name:
        normalizeString(candidate.name || candidate.fullName) ||
        `Candidate ${index + 1}`,
      title: normalizeString(candidate.title),
      date: normalizeString(candidate.date),
      bio,
      shortBio: normalizeString(candidate.shortBio) || bio[0] || "",
      fullProfile: normalizeString(candidate.fullProfile) || bio.join("; "),
      avatar: normalizeString(candidate.avatar),
      achievements: Array.isArray(candidate.achievements)
        ? candidate.achievements.map((entry) => String(entry)).filter(Boolean)
        : bio,
      voteCount:
        typeof candidate.voteCount === "number" ? candidate.voteCount : 0,
    } satisfies Candidate;
  });
}

function validateOpenRoomCandidates(params: {
  status: VoteRoom["status"];
  maxSelection: number;
  candidates: Candidate[];
}) {
  if (params.status !== "open") return null;
  if (params.candidates.length > params.maxSelection) return null;
  return "ຈຳນວນຜູ້ສະໝັກຕ້ອງຫຼາຍກວ່າຈຳນວນສູງສຸດທີ່ເລືອກໄດ້ກ່ອນເປີດຫ້ອງ";
}

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
    allowedUsers: room.allowedUsers || [],
    ownerAdminId: room.ownerAdminId,
    createdAt: room.createdAt?.toISOString?.() || "",
    updatedAt: room.updatedAt?.toISOString?.() || "",
  };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> },
) {
  const auth = await getAuthContext(request, "admin");
  if (!auth) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { roomId } = await params;
  const room = await getRoomByKey(roomId);
  if (!room) {
    return NextResponse.json({ message: "Room not found" }, { status: 404 });
  }

  const activeRoom = await autoCloseExpiredRoom(room);
  return NextResponse.json(serializeRoom(activeRoom));
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> },
) {
  const auth = await getAuthContext(request, "admin");
  if (!auth) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { roomId } = await params;
  const body = await request.json();
  const requestedStatus =
    body?.status !== undefined ? normalizeStatus(body.status) : undefined;
  const update: Record<string, unknown> & {
    startTime?: Date | null;
    endTime?: Date | null;
    timeMode?: "duration" | "range";
    durationMinutes?: number | undefined;
    status?: VoteRoom["status"];
  } = {
    updatedAt: new Date(),
  };

  if (body?.roomName !== undefined) update.roomName = normalizeString(body.roomName);
  if (body?.description !== undefined)
    update.description = normalizeString(body.description);
  if (body?.startTime !== undefined)
    update.startTime = body.startTime ? new Date(String(body.startTime)) : null;
  if (body?.endTime !== undefined)
    update.endTime = body.endTime ? new Date(String(body.endTime)) : null;
  if (body?.timeMode !== undefined)
    update.timeMode = body.timeMode === "duration" ? "duration" : "range";
  if (body?.durationMinutes !== undefined)
    update.durationMinutes = Number.isFinite(Number(body.durationMinutes))
      ? Number(body.durationMinutes)
      : undefined;
  if (body?.voteType !== undefined)
    update.voteType = normalizeVoteType(body.voteType);
  if (body?.maxSelection !== undefined)
    update.maxSelection =
      Number.isFinite(Number(body.maxSelection)) &&
      Number(body.maxSelection) > 0
        ? Number(body.maxSelection)
        : 1;
  if (body?.allowResultView !== undefined)
    update.allowResultView = Boolean(body.allowResultView);
  if (body?.candidates !== undefined)
    update.candidates = normalizeCandidates(body.candidates);
  if (body?.allowedUsers !== undefined) {
    update.allowedUsers = Array.isArray(body.allowedUsers)
      ? body.allowedUsers.map((value: unknown) => String(value))
      : [];
  }

  const currentRoom = await getRoomByKey(roomId);
  if (!currentRoom) {
    return NextResponse.json({ message: "Room not found" }, { status: 404 });
  }

  if (body?.candidates !== undefined && currentRoom.status === "open") {
    return NextResponse.json(
      { message: "ບໍ່ສາມາດແກ້ໄຂຜູ້ສະໝັກໄດ້ໃນຂະນະທີ່ຫ້ອງເປີດຢູ່" },
      { status: 409 },
    );
  }

  const nextStatus = requestedStatus ?? currentRoom.status;
  const nextMaxSelection =
    typeof update.maxSelection === "number"
      ? update.maxSelection
      : currentRoom.maxSelection;
  const nextCandidates = Array.isArray(update.candidates)
    ? (update.candidates as Candidate[])
    : currentRoom.candidates || [];

  const openValidationMessage = validateOpenRoomCandidates({
    status: nextStatus,
    maxSelection: nextMaxSelection,
    candidates: nextCandidates,
  });
  if (openValidationMessage) {
    return NextResponse.json({ message: openValidationMessage }, { status: 400 });
  }

  const isClosedToResetStatus =
    currentRoom.status === "closed" &&
    (requestedStatus === "open" || requestedStatus === "draft");
  if (isClosedToResetStatus) {
    await deleteVotesByRoomId(currentRoom.id);
    if (requestedStatus === "draft") {
      update.startTime = null;
      update.endTime = null;
    }
  }

  if (requestedStatus === "open") {
    update.status = "open";
    const wantsRange =
      body?.timeMode === "range" &&
      update.startTime instanceof Date &&
      update.endTime instanceof Date;
    const effectiveTimeMode =
      (update.timeMode as "duration" | "range" | undefined) ||
      currentRoom.timeMode ||
      "duration";
    const isReopeningFromClosed = currentRoom.status === "closed";
    if (wantsRange) {
      update.timeMode = "range";
    } else if (effectiveTimeMode === "duration" || isReopeningFromClosed) {
      const durationMinutes =
        Number.isFinite(Number(update.durationMinutes)) &&
        Number(update.durationMinutes) > 0
          ? Number(update.durationMinutes)
          : Number.isFinite(Number(currentRoom.durationMinutes)) &&
              Number(currentRoom.durationMinutes) > 0
            ? Number(currentRoom.durationMinutes)
            : 60;
      const now = new Date();
      const startTimeValue =
        update.startTime instanceof Date
          ? update.startTime
          : isReopeningFromClosed
            ? now
            : currentRoom.startTime instanceof Date
              ? currentRoom.startTime
              : now;
      const startTimeMs = startTimeValue.getTime();
      const resolvedStartTime = Number.isNaN(startTimeMs)
        ? now
        : startTimeValue;
      update.startTime = resolvedStartTime;
      update.endTime = new Date(
        resolvedStartTime.getTime() + durationMinutes * 60 * 1000,
      );
      update.durationMinutes = durationMinutes;
      update.timeMode = "duration";
    }
  } else if (requestedStatus === "closed") {
    update.status = "closed";
  } else if (requestedStatus !== undefined) {
    update.status = requestedStatus;
  }

  const updatedRoom = await updateRoom(currentRoom.id, update);
  if (!updatedRoom) {
    return NextResponse.json({ message: "Room not found" }, { status: 404 });
  }

  await syncRoomResultsForRoom(updatedRoom, {
    resetCounts: isClosedToResetStatus,
  });

  if (currentRoom.status !== updatedRoom.status) {
    await emitRoomLifecycleChanged({
      roomId: updatedRoom.id,
      status: updatedRoom.status,
      ownerAdminId: updatedRoom.ownerAdminId,
    });
  }

  if (isClosedToResetStatus) {
    await emitRoomResultsReset({
      roomId: updatedRoom.id,
      ownerAdminId: updatedRoom.ownerAdminId,
    });
  }

  return NextResponse.json(serializeRoom(updatedRoom));
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> },
) {
  const auth = await getAuthContext(request, "admin");
  if (!auth) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { roomId } = await params;
  const currentRoom = await getRoomByKey(roomId);
  if (!currentRoom) {
    return NextResponse.json({ message: "Room not found" }, { status: 404 });
  }

  await deleteVotesByRoomId(currentRoom.id);
  await deleteRoom(currentRoom.id);
  await deleteRoomResultsByRoomId(currentRoom.id);
  await emitRoomLifecycleChanged({
    roomId: currentRoom.id,
    status: "deleted",
    ownerAdminId: currentRoom.ownerAdminId,
  });

  return NextResponse.json({ success: true });
}
