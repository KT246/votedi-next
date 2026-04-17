"use client";

import { doc, onSnapshot } from "firebase/firestore";

import type { VoteResult, VoteStatus } from "@/types";

import { getClientDb } from "./firebaseClient";

export type RoomResultsSnapshot = {
  roomId: string;
  status: VoteStatus;
  totalVotes: number;
  eligibleCount: number;
  votedCount: number;
  notVotedCount: number;
  results: VoteResult[];
};

function normalizeString(value: unknown): string {
  return typeof value === "string" ? value.trim() : String(value || "").trim();
}

function normalizeStatus(value: unknown): VoteStatus {
  const raw = normalizeString(value).toLowerCase();
  if (raw === "open" || raw === "closed" || raw === "pending") {
    return raw;
  }
  return "draft";
}

function normalizeCountMap(value: unknown): VoteResult[] {
  if (!value || typeof value !== "object") return [];

  return Object.entries(value as Record<string, unknown>)
    .map(([candidateId, rawVoteCount]) => ({
      candidateId: normalizeString(candidateId),
      voteCount: Number(rawVoteCount || 0),
    }))
    .filter((entry) => entry.candidateId)
    .sort((left, right) => right.voteCount - left.voteCount);
}

export function subscribeToRoomResults(
  roomId: string,
  handlers: {
    onChange: (snapshot: RoomResultsSnapshot | null) => void;
    onError?: (error: unknown) => void;
  },
) {
  const normalizedRoomId = normalizeString(roomId);
  const clientDb = getClientDb();

  if (!normalizedRoomId || !clientDb) {
    handlers.onChange(null);
    return () => {};
  }

  return onSnapshot(
    doc(clientDb, "room_results", normalizedRoomId),
    (snapshot) => {
      if (!snapshot.exists()) {
        handlers.onChange(null);
        return;
      }

      const data = snapshot.data() as Record<string, unknown>;
      const totalVotes = Number(data.totalVotes || 0);
      const eligibleCount = Number(data.eligibleCount || 0);
      const votedCount = Number(data.votedCount || 0);
      const notVotedCount = Number(data.notVotedCount || 0);

      handlers.onChange({
        roomId: normalizeString(data.roomId) || snapshot.id,
        status: normalizeStatus(data.status),
        totalVotes: Number.isFinite(totalVotes) ? totalVotes : 0,
        eligibleCount: Number.isFinite(eligibleCount) ? eligibleCount : 0,
        votedCount: Number.isFinite(votedCount) ? votedCount : 0,
        notVotedCount: Number.isFinite(notVotedCount) ? notVotedCount : 0,
        results: normalizeCountMap(data.resultCounts),
      });
    },
    (error) => {
      handlers.onError?.(error);
    },
  );
}
