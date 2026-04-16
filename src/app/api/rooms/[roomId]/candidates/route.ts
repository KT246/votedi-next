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

function normalizeCandidate(
  value: unknown,
  fallbackIndex = 0,
  fallbackId?: string,
): Candidate {
  const row = value as Record<string, unknown>;
  const bio = normalizeBio(row.bio ?? row.achievements ?? row.fullProfile);
  const name =
    normalizeString(row.name || row.fullName) ||
    `Candidate ${fallbackIndex + 1}`;
  const generatedId =
    fallbackId ||
    normalizeString(row.id ?? row._id) ||
    `candidate-${Date.now().toString(36)}-${Math.random()
      .toString(36)
      .slice(2, 8)}`;

  return {
    id: generatedId,
    name,
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
  return value.map((item, index) => normalizeCandidate(item, index));
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

  return NextResponse.json(normalizeCandidates(room.candidates || []));
}

export async function POST(
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

  if (room.status === "open") {
    return NextResponse.json(
      { message: "Cannot change candidates while room is open" },
      { status: 409 },
    );
  }

  const body = await request.json();
  const nextCandidate = normalizeCandidate(
    body,
    Array.isArray(room.candidates) ? room.candidates.length : 0,
  );

  if (!nextCandidate.name) {
    return NextResponse.json(
      { message: "Candidate name is required" },
      { status: 400 },
    );
  }

  const currentCandidates = normalizeCandidates(room.candidates || []);
  const updatedRoom = await updateRoom(room.id, {
    candidates: [...currentCandidates, nextCandidate],
    updatedAt: new Date(),
  });

  if (!updatedRoom) {
    return NextResponse.json({ message: "Room not found" }, { status: 404 });
  }

  return NextResponse.json(nextCandidate, { status: 201 });
}
