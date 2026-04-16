import { NextRequest, NextResponse } from "next/server";

import { getAuthContext } from "@/lib/serverAuth";
import { autoCloseExpiredRoom } from "@/lib/roomLifecycle";
import { emitRoomLifecycleChanged } from "@/lib/realtimeEmitter";
import {
  createRoom,
  ensureRoomResultsForRoom,
  generateRoomCode,
  listRooms,
  type RoomRecord,
} from "@/lib/firestoreData";
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
    return value.split(/;/g).map((entry) => entry.trim()).filter(Boolean);
  }
  return [];
}

function normalizeCandidates(value: unknown): Candidate[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item, index) => {
      const candidate = item as Record<string, unknown>;
      const bio = normalizeBio(candidate.bio);
      const achievements = Array.isArray(candidate.achievements)
        ? candidate.achievements.map((entry) => String(entry)).filter(Boolean)
        : bio;
      const id = normalizeString(candidate.id ?? candidate._id) || `candidate-${index + 1}`;
      return {
        id,
        name: normalizeString(candidate.name || candidate.fullName) || `Candidate ${index + 1}`,
        title: normalizeString(candidate.title),
        date: normalizeString(candidate.date),
        bio,
        shortBio: normalizeString(candidate.shortBio),
        fullProfile: normalizeString(candidate.fullProfile) || bio.join("; "),
        avatar: normalizeString(candidate.avatar),
        achievements,
        voteCount: typeof candidate.voteCount === "number" ? candidate.voteCount : 0,
      } satisfies Candidate;
    })
    .filter((item) => item.name);
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

export async function GET(request: NextRequest) {
  const auth = await getAuthContext(request, "admin");
  if (!auth) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const rooms = await listRooms();
  const resolvedRooms = await Promise.all(rooms.map((room) => autoCloseExpiredRoom(room)));
  return NextResponse.json(resolvedRooms.map(serializeRoom));
}

export async function POST(request: NextRequest) {
  const auth = await getAuthContext(request, "admin");
  if (!auth) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const roomName = normalizeString(body?.roomName);
    if (!roomName) {
      return NextResponse.json({ message: "ກະລຸນາປ້ອນຊື່ຫ້ອງ" }, { status: 400 });
    }

    const status = normalizeStatus(body?.status);
    const maxSelection =
      Number.isFinite(Number(body?.maxSelection)) && Number(body.maxSelection) > 0
        ? Number(body.maxSelection)
        : 1;
    const candidates = normalizeCandidates(body?.candidates);

    const openValidationMessage = validateOpenRoomCandidates({
      status,
      maxSelection,
      candidates,
    });
    if (openValidationMessage) {
      return NextResponse.json({ message: openValidationMessage }, { status: 400 });
    }

    const now = new Date();
    const created = await createRoom({
      roomCode: normalizeString(body?.roomCode) || (await generateRoomCode()),
      roomName,
      description: normalizeString(body?.description),
      startTime: body?.startTime ? new Date(String(body.startTime)) : null,
      endTime: body?.endTime ? new Date(String(body.endTime)) : null,
      timeMode: body?.timeMode === "duration" ? "duration" : "range",
      durationMinutes:
        typeof body?.durationMinutes === "number" ? body.durationMinutes : undefined,
      voteType: normalizeVoteType(body?.voteType),
      maxSelection,
      status,
      allowResultView: Boolean(body?.allowResultView),
      candidates,
      allowedUsers: Array.isArray(body?.allowedUsers)
        ? body.allowedUsers.map((value: unknown) => String(value))
        : [],
      ownerAdminId: auth.payload.id || "",
      createdAt: now,
      updatedAt: now,
    });

    await ensureRoomResultsForRoom(created);

    await emitRoomLifecycleChanged({
      roomId: created.id,
      status: created.status,
      ownerAdminId: created.ownerAdminId,
    });

    return NextResponse.json(serializeRoom(created), { status: 201 });
  } catch (error) {
    console.error("Create room error:", error);
    return NextResponse.json({ message: "ສ້າງຫ້ອງບໍ່ສຳເລັດ" }, { status: 500 });
  }
}
