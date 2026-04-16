import { NextRequest, NextResponse } from "next/server";

import { getAuthContext } from "@/lib/serverAuth";
import { getRoomByKey, updateRoom } from "@/lib/firestoreData";
import type { Candidate } from "@/types";

function normalizeString(value: unknown): string {
  return typeof value === "string" ? value.trim() : String(value || "").trim();
}

function normalizeBio(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((entry) => String(entry).trim()).filter(Boolean);
  }
  if (typeof value === "string") {
    return value
      .split(/[;\n]/g)
      .map((entry) => entry.trim())
      .filter(Boolean);
  }
  return [];
}

function normalizeCandidate(value: unknown, fallbackId?: string): Candidate {
  const row = value as Record<string, unknown>;
  const bio = normalizeBio(row.bio ?? row.achievements ?? row.fullProfile);
  return {
    id:
      normalizeString(row.id ?? row._id) ||
      fallbackId ||
      `candidate-${Date.now().toString(36)}`,
    name: normalizeString(row.name || row.fullName),
    title: normalizeString(row.title),
    date: normalizeString(row.date),
    bio,
    shortBio: normalizeString(row.shortBio) || bio[0] || "",
    fullProfile: normalizeString(row.fullProfile) || bio.join("; "),
    avatar: normalizeString(row.avatar),
    achievements: Array.isArray(row.achievements)
      ? row.achievements.map((entry) => String(entry).trim()).filter(Boolean)
      : bio,
    voteCount:
      typeof row.voteCount === "number" && Number.isFinite(row.voteCount)
        ? row.voteCount
        : 0,
  };
}

function normalizeCandidates(value: unknown): Candidate[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => normalizeCandidate(item));
}

export async function PATCH(
  request: NextRequest,
  {
    params,
  }: { params: Promise<{ roomId: string; candidateId: string }> },
) {
  const auth = await getAuthContext(request, "admin");
  if (!auth) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { roomId, candidateId } = await params;
  const room = await getRoomByKey(roomId);
  if (!room) {
    return NextResponse.json({ message: "Room not found" }, { status: 404 });
  }

  if (room.status === "open") {
    return NextResponse.json(
      { message: "Cannot change candidates while room is open" },
      { status: 409 },
    );
  }

  const currentCandidates = normalizeCandidates(room.candidates || []);
  const currentCandidate = currentCandidates.find((item) => item.id === candidateId);
  if (!currentCandidate) {
    return NextResponse.json(
      { message: "Candidate not found" },
      { status: 404 },
    );
  }

  const body = await request.json();
  const nextCandidate = normalizeCandidate(
    {
      ...currentCandidate,
      ...body,
      id: candidateId,
      voteCount:
        typeof body?.voteCount === "number"
          ? body.voteCount
          : currentCandidate.voteCount || 0,
    },
    candidateId,
  );

  if (!nextCandidate.name) {
    return NextResponse.json(
      { message: "Candidate name is required" },
      { status: 400 },
    );
  }

  const updatedRoom = await updateRoom(room.id, {
    candidates: currentCandidates.map((item) =>
      item.id === candidateId ? nextCandidate : item,
    ),
    updatedAt: new Date(),
  });

  if (!updatedRoom) {
    return NextResponse.json({ message: "Room not found" }, { status: 404 });
  }

  return NextResponse.json(nextCandidate);
}

export async function DELETE(
  request: NextRequest,
  {
    params,
  }: { params: Promise<{ roomId: string; candidateId: string }> },
) {
  const auth = await getAuthContext(request, "admin");
  if (!auth) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { roomId, candidateId } = await params;
  const room = await getRoomByKey(roomId);
  if (!room) {
    return NextResponse.json({ message: "Room not found" }, { status: 404 });
  }

  if (room.status === "open") {
    return NextResponse.json(
      { message: "Cannot change candidates while room is open" },
      { status: 409 },
    );
  }

  const currentCandidates = normalizeCandidates(room.candidates || []);
  const exists = currentCandidates.some((item) => item.id === candidateId);
  if (!exists) {
    return NextResponse.json(
      { message: "Candidate not found" },
      { status: 404 },
    );
  }

  const updatedRoom = await updateRoom(room.id, {
    candidates: currentCandidates.filter((item) => item.id !== candidateId),
    updatedAt: new Date(),
  });

  if (!updatedRoom) {
    return NextResponse.json({ message: "Room not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true, candidateId });
}
