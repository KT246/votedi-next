import "server-only";

import type {
  DocumentSnapshot,
  QueryDocumentSnapshot,
} from "firebase-admin/firestore";

import type { Candidate, VoteRoom } from "@/types";

import { getAdminDb } from "./firebaseAdmin";
import type { UserDocument } from "./userAuth";

export type AdminRecord = {
  id: string;
  username: string;
  fullName: string;
  password: string;
  role?: "admin";
  createdAt?: Date;
  updatedAt?: Date;
};

export type RoomRecord = Omit<
  VoteRoom,
  "id" | "createdAt" | "updatedAt" | "candidates" | "allowedUsers" | "startTime" | "endTime"
> & {
  id: string;
  startTime: Date | null;
  endTime: Date | null;
  ownerAdminId: string;
  candidates: Candidate[];
  allowedUsers: string[];
  createdAt?: Date;
  updatedAt?: Date;
};

export type VoteRecord = {
  id: string;
  roomId: string;
  roomCode: string;
  userId: string;
  selectedIds: string[];
  votedAt: Date;
};

export type RoomResultsRecord = {
  id: string;
  roomId: string;
  status: VoteRoom["status"];
  resultCounts: Record<string, number>;
  totalVotes: number;
  eligibleCount: number;
  votedCount: number;
  notVotedCount: number;
  updatedAt?: Date;
  lastVoteAt?: Date;
};

export type SubmitVoteResult =
  | {
      ok: true;
      room: RoomRecord;
      vote: VoteRecord;
      results: RoomResultsRecord;
    }
  | {
      ok: false;
      code:
        | "ROOM_NOT_FOUND"
        | "USER_NOT_FOUND"
        | "ROOM_ACCESS_DENIED"
        | "ROOM_NOT_OPEN"
        | "INVALID_OPTION"
        | "ALREADY_VOTED";
      message: string;
      status: number;
      room?: RoomRecord;
      vote?: VoteRecord;
      results?: RoomResultsRecord;
      roomStatusChanged?: boolean;
    };

const db = () => getAdminDb();

function adminsCollection() {
  return db().collection("admins");
}

function usersCollection() {
  return db().collection("users");
}

function roomsCollection() {
  return db().collection("rooms");
}

function votesCollection() {
  return db().collection("votes");
}

function roomResultsCollection() {
  return db().collection("room_results");
}

function normalizeString(value: unknown): string {
  return typeof value === "string" ? value.trim() : String(value || "").trim();
}

function toDate(value: unknown): Date | undefined {
  if (!value) return undefined;
  if (value instanceof Date) return value;

  if (
    typeof value === "object" &&
    value !== null &&
    "toDate" in value &&
    typeof (value as { toDate?: () => Date }).toDate === "function"
  ) {
    return (value as { toDate: () => Date }).toDate();
  }

  if (typeof value === "string") {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }

  return undefined;
}

function normalizeBio(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((entry) => normalizeString(entry)).filter(Boolean);
  }
  if (typeof value === "string") {
    return value
      .split(/[;\n]/g)
      .map((entry) => entry.trim())
      .filter(Boolean);
  }
  return [];
}

function normalizeCountMap(value: unknown): Record<string, number> {
  if (!value || typeof value !== "object") return {};

  const counts: Record<string, number> = {};
  for (const [rawKey, rawValue] of Object.entries(value as Record<string, unknown>)) {
    const key = normalizeString(rawKey);
    if (!key) continue;

    const numericValue = Number(rawValue);
    if (!Number.isFinite(numericValue) || numericValue < 0) continue;
    counts[key] = numericValue;
  }

  return counts;
}

function countEligibleUsers(room: Pick<RoomRecord, "allowedUsers">): number {
  return Array.from(new Set((room.allowedUsers || []).map((entry) => normalizeString(entry)).filter(Boolean))).length;
}

function resolveRoomDeadline(room: Pick<RoomRecord, "startTime" | "endTime" | "timeMode" | "durationMinutes">): Date | null {
  if (room.endTime instanceof Date) {
    return Number.isNaN(room.endTime.getTime()) ? null : room.endTime;
  }

  if (
    room.startTime instanceof Date &&
    (room.timeMode === "duration" || room.timeMode === undefined) &&
    Number.isFinite(Number(room.durationMinutes)) &&
    Number(room.durationMinutes) > 0
  ) {
    const deadline = new Date(
      room.startTime.getTime() + Number(room.durationMinutes) * 60 * 1000,
    );
    return Number.isNaN(deadline.getTime()) ? null : deadline;
  }

  return null;
}

function normalizeCandidate(value: unknown, index: number): Candidate {
  const item = (value || {}) as Record<string, unknown>;
  const bio = normalizeBio(item.bio);
  return {
    id: normalizeString(item.id) || `candidate-${index + 1}`,
    name:
      normalizeString(item.name || item.fullName) || `Candidate ${index + 1}`,
    title: normalizeString(item.title),
    date: normalizeString(item.date),
    bio,
    shortBio: normalizeString(item.shortBio) || bio[0] || "",
    fullProfile: normalizeString(item.fullProfile) || bio.join("; "),
    avatar: normalizeString(item.avatar),
    achievements: Array.isArray(item.achievements)
      ? item.achievements.map((entry) => normalizeString(entry)).filter(Boolean)
      : bio,
    voteCount:
      typeof item.voteCount === "number" && Number.isFinite(item.voteCount)
        ? item.voteCount
        : 0,
  };
}

function normalizeCandidates(value: unknown): Candidate[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((candidate, index) => normalizeCandidate(candidate, index))
    .filter((candidate) => candidate.name);
}

function toAdminRecord(
  snapshot: QueryDocumentSnapshot,
): AdminRecord {
  const data = snapshot.data();
  return {
    id: snapshot.id,
    username: normalizeString(data.username),
    fullName: normalizeString(data.fullName),
    password: normalizeString(data.password),
    role: "admin",
    createdAt: toDate(data.createdAt),
    updatedAt: toDate(data.updatedAt),
  };
}

function toUserRecord(snapshot: QueryDocumentSnapshot): UserDocument {
  const data = snapshot.data();
  return {
    id: snapshot.id,
    fullName: normalizeString(data.fullName),
    studentId: normalizeString(data.studentId),
    avatar: normalizeString(data.avatar),
    password: normalizeString(data.password),
    mustChangePassword: Boolean(data.mustChangePassword),
    activeDeviceId: normalizeString(data.activeDeviceId),
    activeDeviceBoundAt: toDate(data.activeDeviceBoundAt),
    createdByAdminId: normalizeString(data.createdByAdminId),
    role: "user",
    createdAt: toDate(data.createdAt),
    updatedAt: toDate(data.updatedAt),
  };
}

function toRoomRecord(snapshot: QueryDocumentSnapshot): RoomRecord {
  const data = snapshot.data();
  return {
    id: snapshot.id,
    roomCode: normalizeString(data.roomCode),
    roomName: normalizeString(data.roomName),
    description: normalizeString(data.description),
    startTime: toDate(data.startTime) || null,
    endTime: toDate(data.endTime) || null,
    timeMode: data.timeMode === "duration" ? "duration" : "range",
    durationMinutes:
      typeof data.durationMinutes === "number" ? data.durationMinutes : undefined,
    voteType:
      data.voteType === "multi" || data.voteType === "option"
        ? data.voteType
        : "single",
    maxSelection:
      typeof data.maxSelection === "number" && data.maxSelection > 0
        ? data.maxSelection
        : 1,
    status:
      data.status === "open" ||
      data.status === "closed" ||
      data.status === "pending"
        ? data.status
        : "draft",
    allowResultView: Boolean(data.allowResultView),
    candidates: normalizeCandidates(data.candidates),
    allowedUsers: Array.isArray(data.allowedUsers)
      ? data.allowedUsers.map((entry) => normalizeString(entry)).filter(Boolean)
      : [],
    ownerAdminId: normalizeString(data.ownerAdminId),
    createdAt: toDate(data.createdAt),
    updatedAt: toDate(data.updatedAt),
  };
}

function toVoteRecord(snapshot: QueryDocumentSnapshot): VoteRecord {
  const data = snapshot.data();
  return {
    id: snapshot.id,
    roomId: normalizeString(data.roomId),
    roomCode: normalizeString(data.roomCode),
    userId: normalizeString(data.userId),
    selectedIds: Array.isArray(data.selectedIds)
      ? data.selectedIds.map((entry) => normalizeString(entry)).filter(Boolean)
      : [],
    votedAt: toDate(data.votedAt) || new Date(),
  };
}

function toRoomResultsRecord(
  snapshot: QueryDocumentSnapshot | DocumentSnapshot,
): RoomResultsRecord {
  const data = snapshot.data() || {};
  const totalVotes = Number(data.totalVotes || 0);
  const eligibleCount = Number(data.eligibleCount || 0);
  const votedCount = Number(data.votedCount || 0);

  return {
    id: snapshot.id,
    roomId: normalizeString(data.roomId) || snapshot.id,
    status:
      data.status === "draft" ||
      data.status === "pending" ||
      data.status === "open" ||
      data.status === "closed"
        ? data.status
        : "draft",
    resultCounts: normalizeCountMap(data.resultCounts),
    totalVotes: Number.isFinite(totalVotes) && totalVotes > 0 ? totalVotes : 0,
    eligibleCount:
      Number.isFinite(eligibleCount) && eligibleCount > 0 ? eligibleCount : 0,
    votedCount: Number.isFinite(votedCount) && votedCount > 0 ? votedCount : 0,
    notVotedCount:
      typeof data.notVotedCount === "number" && Number.isFinite(data.notVotedCount)
        ? Math.max(data.notVotedCount, 0)
        : Math.max(eligibleCount - votedCount, 0),
    updatedAt: toDate(data.updatedAt),
    lastVoteAt: toDate(data.lastVoteAt),
  };
}

function voteDocId(roomId: string, userId: string) {
  return `${roomId}__${userId}`;
}

export async function getAdminByUsername(username: string) {
  const snapshot = await adminsCollection()
    .where("username", "==", normalizeString(username))
    .limit(1)
    .get();
  return snapshot.empty ? null : toAdminRecord(snapshot.docs[0]!);
}

export async function getAdminById(adminId: string) {
  const snapshot = await adminsCollection().doc(normalizeString(adminId)).get();
  return snapshot.exists
    ? toAdminRecord(snapshot as QueryDocumentSnapshot)
    : null;
}

export async function updateAdmin(
  adminId: string,
  updates: Record<string, unknown>,
) {
  const adminRef = adminsCollection().doc(normalizeString(adminId));
  await adminRef.update({
    ...updates,
    updatedAt: new Date(),
  });
  const snapshot = await adminRef.get();
  return snapshot.exists ? toAdminRecord(snapshot as QueryDocumentSnapshot) : null;
}

export async function replaceAllAdmins(
  admin: Omit<AdminRecord, "id">,
) {
  const existing = await adminsCollection().get();
  const batch = db().batch();
  existing.docs.forEach((doc) => batch.delete(doc.ref));
  const nextRef = adminsCollection().doc();
  batch.set(nextRef, {
    ...admin,
    createdAt: admin.createdAt || new Date(),
    updatedAt: admin.updatedAt || new Date(),
  });
  await batch.commit();
  return nextRef.id;
}

export async function listUsers() {
  const snapshot = await usersCollection().orderBy("createdAt", "desc").get();
  return snapshot.docs.map((doc) => toUserRecord(doc));
}

export async function getUserById(userId: string) {
  const snapshot = await usersCollection().doc(normalizeString(userId)).get();
  return snapshot.exists ? toUserRecord(snapshot as QueryDocumentSnapshot) : null;
}

export async function getUserByStudentId(studentId: string) {
  const snapshot = await usersCollection()
    .where("studentId", "==", normalizeString(studentId))
    .limit(1)
    .get();
  return snapshot.empty ? null : toUserRecord(snapshot.docs[0]!);
}

export async function createUser(
  payload: Omit<UserDocument, "id">,
) {
  const ref = usersCollection().doc();
  await ref.set({
    ...payload,
    createdAt: payload.createdAt || new Date(),
    updatedAt: payload.updatedAt || new Date(),
  });
  const snapshot = await ref.get();
  return toUserRecord(snapshot as QueryDocumentSnapshot);
}

export async function createUsersBulk(
  users: Array<Omit<UserDocument, "id">>,
) {
  if (users.length === 0) return [];

  const batch = db().batch();
  const refs = users.map(() => usersCollection().doc());
  refs.forEach((ref, index) => {
    const user = users[index]!;
    batch.set(ref, {
      ...user,
      createdAt: user.createdAt || new Date(),
      updatedAt: user.updatedAt || new Date(),
    });
  });
  await batch.commit();

  const snapshots = await Promise.all(refs.map((ref) => ref.get()));
  return snapshots
    .filter((snapshot) => snapshot.exists)
    .map((snapshot) => toUserRecord(snapshot as QueryDocumentSnapshot));
}

export async function updateUser(
  userId: string,
  updates: Record<string, unknown>,
) {
  const ref = usersCollection().doc(normalizeString(userId));
  await ref.update({
    ...updates,
    updatedAt: new Date(),
  });
  const snapshot = await ref.get();
  return snapshot.exists ? toUserRecord(snapshot as QueryDocumentSnapshot) : null;
}

export async function deleteUser(userId: string) {
  await usersCollection().doc(normalizeString(userId)).delete();
}

export async function listUsersByIds(userIds: string[]) {
  const uniqueIds = Array.from(new Set(userIds.map((id) => normalizeString(id)).filter(Boolean)));
  const snapshots = await Promise.all(
    uniqueIds.map((userId) => usersCollection().doc(userId).get()),
  );
  return snapshots
    .filter((snapshot) => snapshot.exists)
    .map((snapshot) => toUserRecord(snapshot as QueryDocumentSnapshot));
}

export async function claimUserDevice(userId: string, deviceId: string) {
  const ref = usersCollection().doc(normalizeString(userId));
  const result = await db().runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists) {
      return false;
    }

    const user = toUserRecord(snapshot as QueryDocumentSnapshot);
    const activeDeviceId = normalizeString(user.activeDeviceId);
    if (activeDeviceId && activeDeviceId !== deviceId) {
      return false;
    }

    transaction.update(ref, {
      activeDeviceId: normalizeString(deviceId),
      activeDeviceBoundAt: new Date(),
      updatedAt: new Date(),
    });
    return true;
  });

  return result;
}

export async function clearUserDeviceBinding(userId: string, deviceId: string) {
  const ref = usersCollection().doc(normalizeString(userId));
  await db().runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists) return;

    const user = toUserRecord(snapshot as QueryDocumentSnapshot);
    if (normalizeString(user.activeDeviceId) !== normalizeString(deviceId)) {
      return;
    }

    transaction.update(ref, {
      activeDeviceId: "",
      activeDeviceBoundAt: null,
      updatedAt: new Date(),
    });
  });
}

export async function listRooms() {
  const snapshot = await roomsCollection().orderBy("createdAt", "desc").get();
  return snapshot.docs.map((doc) => toRoomRecord(doc));
}

export async function listRoomsForAdmin(adminId: string) {
  const snapshot = await roomsCollection()
    .where("ownerAdminId", "==", normalizeString(adminId))
    .orderBy("updatedAt", "desc")
    .get();
  return snapshot.docs.map((doc) => toRoomRecord(doc));
}

export async function listRoomsForUser(userId: string, ownerAdminId = "") {
  const [allowedSnapshot, ownerSnapshot] = await Promise.all([
    roomsCollection()
      .where("allowedUsers", "array-contains", normalizeString(userId))
      .get(),
    ownerAdminId
      ? roomsCollection()
          .where("ownerAdminId", "==", normalizeString(ownerAdminId))
          .get()
      : Promise.resolve(null),
  ]);

  const roomMap = new Map<string, RoomRecord>();
  allowedSnapshot.docs.forEach((doc) => roomMap.set(doc.id, toRoomRecord(doc)));
  ownerSnapshot?.docs.forEach((doc) => roomMap.set(doc.id, toRoomRecord(doc)));

  return Array.from(roomMap.values()).sort((a, b) => {
    const aTime = a.updatedAt?.getTime() || a.createdAt?.getTime() || 0;
    const bTime = b.updatedAt?.getTime() || b.createdAt?.getTime() || 0;
    return bTime - aTime;
  });
}

export async function getRoomById(roomId: string) {
  const snapshot = await roomsCollection().doc(normalizeString(roomId)).get();
  return snapshot.exists ? toRoomRecord(snapshot as QueryDocumentSnapshot) : null;
}

export async function getRoomByCode(code: string) {
  const snapshot = await roomsCollection()
    .where("roomCode", "==", normalizeString(code))
    .limit(1)
    .get();
  return snapshot.empty ? null : toRoomRecord(snapshot.docs[0]!);
}

export async function getRoomByKey(roomKey: string) {
  const byId = await getRoomById(roomKey);
  if (byId) return byId;
  return getRoomByCode(roomKey);
}

export async function createRoom(
  payload: Omit<RoomRecord, "id">,
) {
  const ref = roomsCollection().doc();
  await ref.set({
    ...payload,
    createdAt: payload.createdAt || new Date(),
    updatedAt: payload.updatedAt || new Date(),
  });
  const snapshot = await ref.get();
  return toRoomRecord(snapshot as QueryDocumentSnapshot);
}

export async function updateRoom(
  roomId: string,
  updates: Record<string, unknown>,
) {
  const ref = roomsCollection().doc(normalizeString(roomId));
  await ref.update({
    ...updates,
    updatedAt: new Date(),
  });
  const snapshot = await ref.get();
  return snapshot.exists ? toRoomRecord(snapshot as QueryDocumentSnapshot) : null;
}

export async function deleteRoom(roomId: string) {
  await roomsCollection().doc(normalizeString(roomId)).delete();
}

export async function generateRoomCode() {
  const charset = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

  for (let attempt = 0; attempt < 10; attempt += 1) {
    let code = "";
    for (let index = 0; index < 6; index += 1) {
      code += charset[Math.floor(Math.random() * charset.length)];
    }

    const existing = await getRoomByCode(code);
    if (!existing) return code;
  }

  return `R${Date.now().toString(36).toUpperCase()}`;
}

export async function getVoteByRoomAndUser(roomId: string, userId: string) {
  const snapshot = await votesCollection()
    .doc(voteDocId(normalizeString(roomId), normalizeString(userId)))
    .get();
  return snapshot.exists ? toVoteRecord(snapshot as QueryDocumentSnapshot) : null;
}

export async function listVotesByRoomId(roomId: string) {
  const snapshot = await votesCollection()
    .where("roomId", "==", normalizeString(roomId))
    .get();
  return snapshot.docs.map((doc) => toVoteRecord(doc));
}

export async function getRoomResultsByRoomId(roomId: string) {
  const snapshot = await roomResultsCollection()
    .doc(normalizeString(roomId))
    .get();
  return snapshot.exists ? toRoomResultsRecord(snapshot) : null;
}

export async function ensureRoomResultsForRoom(room: RoomRecord) {
  const roomId = normalizeString(room.id);
  if (!roomId) return null;

  const existing = await getRoomResultsByRoomId(roomId);
  if (existing) return existing;

  const eligibleCount = countEligibleUsers(room);
  const payload = {
    roomId,
    status: room.status,
    resultCounts: {},
    totalVotes: 0,
    eligibleCount,
    votedCount: 0,
    notVotedCount: Math.max(eligibleCount, 0),
    updatedAt: new Date(),
  };

  await roomResultsCollection().doc(roomId).set(payload, { merge: true });
  const snapshot = await roomResultsCollection().doc(roomId).get();
  return snapshot.exists ? toRoomResultsRecord(snapshot) : null;
}

export async function syncRoomResultsForRoom(
  room: RoomRecord,
  options?: { resetCounts?: boolean },
) {
  const roomId = normalizeString(room.id);
  if (!roomId) return null;

  const ref = roomResultsCollection().doc(roomId);
  const existingSnapshot = await ref.get();
  const existing = existingSnapshot.exists
    ? toRoomResultsRecord(existingSnapshot)
    : null;
  const eligibleCount = countEligibleUsers(room);
  const totalVotes = options?.resetCounts ? 0 : existing?.totalVotes || 0;
  const votedCount = options?.resetCounts ? 0 : existing?.votedCount || 0;

  await ref.set(
    {
      roomId,
      status: room.status,
      resultCounts: options?.resetCounts ? {} : existing?.resultCounts || {},
      totalVotes,
      eligibleCount,
      votedCount,
      notVotedCount: Math.max(eligibleCount - votedCount, 0),
      updatedAt: new Date(),
      ...(options?.resetCounts ? { lastVoteAt: null } : {}),
    },
    { merge: true },
  );

  const snapshot = await ref.get();
  return snapshot.exists ? toRoomResultsRecord(snapshot) : null;
}

export async function deleteRoomResultsByRoomId(roomId: string) {
  await roomResultsCollection().doc(normalizeString(roomId)).delete();
}

export async function deleteVotesByRoomId(roomId: string) {
  const snapshot = await votesCollection()
    .where("roomId", "==", normalizeString(roomId))
    .get();
  if (snapshot.empty) return;

  const batch = db().batch();
  snapshot.docs.forEach((doc) => batch.delete(doc.ref));
  await batch.commit();
}

export async function submitVote(payload: {
  roomId: string;
  userId: string;
  selectedIds: string[];
}) {
  const normalizedRoomId = normalizeString(payload.roomId);
  const normalizedUserId = normalizeString(payload.userId);
  const selectedIds = Array.from(
    new Set(payload.selectedIds.map((entry) => normalizeString(entry)).filter(Boolean)),
  );

  if (!normalizedRoomId) {
    return {
      ok: false,
      code: "ROOM_NOT_FOUND",
      message: "Room not found",
      status: 404,
    } satisfies SubmitVoteResult;
  }

  if (!normalizedUserId) {
    return {
      ok: false,
      code: "USER_NOT_FOUND",
      message: "User not found",
      status: 404,
    } satisfies SubmitVoteResult;
  }

  if (selectedIds.length === 0) {
    return {
      ok: false,
      code: "INVALID_OPTION",
      message: "At least one candidate is required",
      status: 400,
    } satisfies SubmitVoteResult;
  }

  return db().runTransaction(async (transaction) => {
    const roomRef = roomsCollection().doc(normalizedRoomId);
    const userRef = usersCollection().doc(normalizedUserId);
    const voteRef = votesCollection().doc(voteDocId(normalizedRoomId, normalizedUserId));
    const resultsRef = roomResultsCollection().doc(normalizedRoomId);

    const [roomSnapshot, userSnapshot, voteSnapshot, resultsSnapshot] =
      await Promise.all([
        transaction.get(roomRef),
        transaction.get(userRef),
        transaction.get(voteRef),
        transaction.get(resultsRef),
      ]);

    if (!roomSnapshot.exists) {
      return {
        ok: false,
        code: "ROOM_NOT_FOUND",
        message: "Room not found",
        status: 404,
      } satisfies SubmitVoteResult;
    }

    const room = toRoomRecord(roomSnapshot as QueryDocumentSnapshot);
    if (!userSnapshot.exists) {
      return {
        ok: false,
        code: "USER_NOT_FOUND",
        message: "User not found",
        status: 404,
        room,
      } satisfies SubmitVoteResult;
    }

    const user = toUserRecord(userSnapshot as QueryDocumentSnapshot);
    const isAllowed =
      room.allowedUsers.includes(normalizedUserId) ||
      (room.ownerAdminId &&
        room.ownerAdminId === normalizeString(user.createdByAdminId));
    if (!isAllowed) {
      return {
        ok: false,
        code: "ROOM_ACCESS_DENIED",
        message: "User is not allowed in this room",
        status: 403,
        room,
      } satisfies SubmitVoteResult;
    }

    const now = new Date();
    const deadline = resolveRoomDeadline(room);
    if (
      room.status === "open" &&
      deadline &&
      deadline.getTime() <= now.getTime()
    ) {
      const existingResults = resultsSnapshot.exists
        ? toRoomResultsRecord(resultsSnapshot)
        : null;
      const eligibleCount = countEligibleUsers(room);
      const votedCount = existingResults?.votedCount || 0;

      transaction.update(roomRef, {
        status: "closed",
        updatedAt: now,
      });
      transaction.set(
        resultsRef,
        {
          roomId: room.id,
          status: "closed",
          resultCounts: existingResults?.resultCounts || {},
          totalVotes: existingResults?.totalVotes || 0,
          eligibleCount,
          votedCount,
          notVotedCount: Math.max(eligibleCount - votedCount, 0),
          updatedAt: now,
        },
        { merge: true },
      );

      return {
        ok: false,
        code: "ROOM_NOT_OPEN",
        message: "Room is not open",
        status: 403,
        room: { ...room, status: "closed", updatedAt: now },
        results: {
          id: resultsRef.id,
          roomId: room.id,
          status: "closed",
          resultCounts: existingResults?.resultCounts || {},
          totalVotes: existingResults?.totalVotes || 0,
          eligibleCount,
          votedCount,
          notVotedCount: Math.max(eligibleCount - votedCount, 0),
          updatedAt: now,
          lastVoteAt: existingResults?.lastVoteAt,
        },
        roomStatusChanged: true,
      } satisfies SubmitVoteResult;
    }

    if (room.status !== "open") {
      return {
        ok: false,
        code: "ROOM_NOT_OPEN",
        message: "Room is not open",
        status: 403,
        room,
      } satisfies SubmitVoteResult;
    }

    const allowedCandidateIds = new Set(
      (room.candidates || []).map((candidate) => normalizeString(candidate.id)).filter(Boolean),
    );
    if (
      selectedIds.length > Math.max(Number(room.maxSelection || 1), 1) ||
      selectedIds.some((entry) => !allowedCandidateIds.has(entry))
    ) {
      return {
        ok: false,
        code: "INVALID_OPTION",
        message: "Selected candidate is invalid",
        status: 400,
        room,
      } satisfies SubmitVoteResult;
    }

    if (voteSnapshot.exists) {
      return {
        ok: false,
        code: "ALREADY_VOTED",
        message: "User already voted in this room",
        status: 409,
        room,
        vote: toVoteRecord(voteSnapshot as QueryDocumentSnapshot),
        results: resultsSnapshot.exists
          ? toRoomResultsRecord(resultsSnapshot)
          : undefined,
      } satisfies SubmitVoteResult;
    }

    const existingResults = resultsSnapshot.exists
      ? toRoomResultsRecord(resultsSnapshot)
      : null;
    const nextCounts = { ...(existingResults?.resultCounts || {}) };
    for (const selectedId of selectedIds) {
      nextCounts[selectedId] = (nextCounts[selectedId] || 0) + 1;
    }

    const eligibleCount = countEligibleUsers(room);
    const votedCount = (existingResults?.votedCount || 0) + 1;
    const nextResults: RoomResultsRecord = {
      id: resultsRef.id,
      roomId: room.id,
      status: room.status,
      resultCounts: nextCounts,
      totalVotes: (existingResults?.totalVotes || 0) + 1,
      eligibleCount,
      votedCount,
      notVotedCount: Math.max(eligibleCount - votedCount, 0),
      updatedAt: now,
      lastVoteAt: now,
    };

    const vote: VoteRecord = {
      id: voteRef.id,
      roomId: room.id,
      roomCode: room.roomCode,
      userId: normalizedUserId,
      selectedIds,
      votedAt: now,
    };

    transaction.create(voteRef, {
      roomId: vote.roomId,
      roomCode: vote.roomCode,
      userId: vote.userId,
      selectedIds: vote.selectedIds,
      votedAt: vote.votedAt,
    });
    transaction.set(
      resultsRef,
      {
        roomId: room.id,
        status: room.status,
        resultCounts: nextResults.resultCounts,
        totalVotes: nextResults.totalVotes,
        eligibleCount: nextResults.eligibleCount,
        votedCount: nextResults.votedCount,
        notVotedCount: nextResults.notVotedCount,
        updatedAt: nextResults.updatedAt,
        lastVoteAt: nextResults.lastVoteAt,
      },
      { merge: true },
    );

    return {
      ok: true,
      room,
      vote,
      results: nextResults,
    } satisfies SubmitVoteResult;
  });
}
