"use client";

import Link from "next/link";
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronUp, Eye, FilePenLine, Lock, Play, Trash2 } from "lucide-react";

import AdminRoute from "../../../components/AdminRoute";
import { acquireSocket, joinSocketRoom, leaveSocketRoom, releaseSocket } from "../../../api/socketClient";
import EmptyState from "../../../components/ui/EmptyState";
import ErrorState from "../../../components/ui/ErrorState";
import LoadingState from "../../../components/ui/LoadingState";
import StatusBadge from "../../../components/ui/StatusBadge";
import PageHeader from "../../../components/ui/PageHeader";
import { roomsApi } from "../../../api/roomsApi";
import { useAdminAuthStore } from "../../../store/adminAuthStore";
import type { VoteRoom } from "../../../types";
import { useDebouncedValue } from "../../../hooks/useDebouncedValue";
import { formatLaoDateTime } from "../../../lib/formatLaoDate";

type RoomStatus = VoteRoom["status"];

interface AdminRoom extends VoteRoom {
  id: string;
  ownerAdminId?: string;
  createdAt?: string;
  updatedAt?: string;
}

const STATUS_LABELS: Partial<Record<RoomStatus, string>> = {
  draft: "ຮ່າງ",
  open: "ເປີດ",
  closed: "ປິດ",
};

function normalizeRoomId(value: unknown): string {
  if (!value) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number") return String(value);
  if (typeof value === "object") {
    const raw = value as {
      $oid?: unknown;
      id?: unknown;
      _id?: unknown;
      toString?: () => string;
    };
    if (typeof raw.$oid === "string") return raw.$oid;
    if (typeof raw.id === "string") return raw.id;
    if (typeof raw._id === "string") return raw._id;
    if (typeof raw.toString === "function") {
      const result = raw.toString();
      if (result && result !== "[object Object]") return result;
    }
  }
  return String(value);
}

function normalizeStatus(value: unknown): RoomStatus {
  const raw = String(value || "").trim().toLowerCase().replace(/[^a-z]/g, "");
  if (raw === "draft" || raw === "pending" || raw === "open" || raw === "closed") {
    if (raw === "pending") return "draft";
    return raw;
  }
  return "draft";
}

function normalizeRoom(room: unknown): AdminRoom {
  const item = room as Record<string, unknown>;
  return {
    id: normalizeRoomId(item.id ?? item._id),
    roomCode: String(item.roomCode || ""),
    roomName: String(item.roomName || ""),
    description: String(item.description || ""),
    startTime: item.startTime ? String(item.startTime) : null,
    endTime: item.endTime ? String(item.endTime) : null,
    timeMode: item.timeMode === "duration" ? "duration" : "range",
    durationMinutes:
      typeof item.durationMinutes === "number" ? item.durationMinutes : undefined,
    voteType:
      item.voteType === "multi" || item.voteType === "option"
        ? item.voteType
        : "single",
    maxSelection: typeof item.maxSelection === "number" ? item.maxSelection : 1,
    status: normalizeStatus(item.status),
    allowResultView: Boolean(item.allowResultView),
    candidates: Array.isArray(item.candidates) ? item.candidates : [],
    allowedUsers: Array.isArray(item.allowedUsers) ? item.allowedUsers : [],
    ownerAdminId: normalizeRoomId(item.ownerAdminId),
    createdAt: item.createdAt ? String(item.createdAt) : undefined,
    updatedAt: item.updatedAt ? String(item.updatedAt) : undefined,
  };
}

function compactText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function statusTone(status: RoomStatus): "info" | "warning" | "success" | "neutral" {
  if (status === "open") return "success";
  if (status === "draft") return "info";
  return "neutral";
}

function formatDate(value?: string): string {
  return formatLaoDateTime(value, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export default function AdminVoteRoomsPage() {
  const adminId = useAdminAuthStore((state) => state.adminUser?.id || "");
  const [rooms, setRooms] = useState<AdminRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | RoomStatus>("all");
  const [deletingRoomId, setDeletingRoomId] = useState("");
  const [updatingRoomId, setUpdatingRoomId] = useState("");
  const [expandedRoomId, setExpandedRoomId] = useState("");
  const reloadTimerRef = useRef<number | null>(null);
  const debouncedSearch = useDebouncedValue(search, 1000);

  const fetchRooms = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await roomsApi.getAll();
      const mapped = Array.isArray(res.data) ? res.data.map(normalizeRoom) : [];
      setRooms(mapped);
    } catch (err: unknown) {
      const typedErr = err as {
        response?: { data?: { message?: string | string[] } };
        message?: string;
      };
      const message = typedErr?.response?.data?.message;
      setError(
        Array.isArray(message)
          ? message.join(", ")
          : message || typedErr?.message || "ບໍ່ສາມາດໂຫຼດຫ້ອງໄດ້",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchRooms();
  }, [fetchRooms]);

  useEffect(() => {
    const socket = acquireSocket();
    if (!socket) return;

    const adminScope = "admin:rooms";
    const ownerScope = adminId ? `owner:${adminId}` : "";
    joinSocketRoom(adminScope);
    if (ownerScope) {
      joinSocketRoom(ownerScope);
    }

    const scheduleReload = () => {
      if (reloadTimerRef.current) {
        window.clearTimeout(reloadTimerRef.current);
      }

      reloadTimerRef.current = window.setTimeout(() => {
        void fetchRooms();
        reloadTimerRef.current = null;
      }, 300);
    };

    const handleRoomsStatusChanged = (payload: {
      roomId?: unknown;
      status?: unknown;
    }) => {
      const changedRoomId = normalizeRoomId(payload?.roomId);
      if (!changedRoomId) {
        scheduleReload();
        return;
      }

      const nextStatus = normalizeStatus(payload?.status);
      let foundRoom = false;

      setRooms((prev) =>
        prev.map((room) => {
          if (room.id !== changedRoomId) return room;
          foundRoom = true;
          if (room.status === nextStatus) return room;
          return {
            ...room,
            status: nextStatus,
            updatedAt: new Date().toISOString(),
          };
        }),
      );

      if (!foundRoom) {
        scheduleReload();
      }
    };

    socket.on("rooms:status-changed", handleRoomsStatusChanged);

    return () => {
      socket.off("rooms:status-changed", handleRoomsStatusChanged);
      leaveSocketRoom(adminScope);
      if (ownerScope) {
        leaveSocketRoom(ownerScope);
      }
      releaseSocket();
    };
  }, [adminId, fetchRooms]);

  useEffect(() => {
    return () => {
      if (reloadTimerRef.current) {
        window.clearTimeout(reloadTimerRef.current);
      }
    };
  }, []);

  const filteredRooms = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase();
    return rooms.filter((room) => {
      if (statusFilter !== "all" && room.status !== statusFilter) return false;
      if (!q) return true;
      return (
        room.roomName.toLowerCase().includes(q) ||
        room.roomCode.toLowerCase().includes(q) ||
        room.description.toLowerCase().includes(q)
      );
    });
  }, [rooms, debouncedSearch, statusFilter]);

  const stats = useMemo(
    () => ({
      total: rooms.length,
      open: rooms.filter((room) => room.status === "open").length,
      draft: rooms.filter((room) => room.status === "draft").length,
      closed: rooms.filter((room) => room.status === "closed").length,
    }),
    [rooms],
  );

  const handleDeleteRoom = async (room: AdminRoom) => {
    const confirmed = window.confirm(`ຕ້ອງການລົບຫ້ອງ "${room.roomName}" ຫຼືບໍ?`);
    if (!confirmed) return;

    setDeletingRoomId(room.id);
    try {
      await roomsApi.delete(room.id);
      setRooms((prev) => prev.filter((item) => item.id !== room.id));
    } catch (err: unknown) {
      const typedErr = err as {
        response?: { data?: { message?: string | string[] } };
        message?: string;
      };
      const message = typedErr?.response?.data?.message;
      setError(
        Array.isArray(message)
          ? message.join(", ")
          : message || typedErr?.message || "ບໍ່ສາມາດລົບຫ້ອງໄດ້",
      );
    } finally {
      setDeletingRoomId("");
    }
  };

  const handleUpdateStatus = async (room: AdminRoom, status: RoomStatus) => {
    if (room.status === status) return;

    if (room.status === "closed" && (status === "open" || status === "draft")) {
      const confirmed = window.confirm(
        "ຫ້ອງນີ້ຖືກປິດແລ້ວ. ຖ້າເປີດຄືນ ຫຼື ປ່ຽນກັບເປັນຮ່າງ ຜົນເກົ່າຈະຖືກລ້າງ",
      );
      if (!confirmed) return;
    }

    setUpdatingRoomId(room.id);
    try {
      const res = await roomsApi.updateStatus(room.id, status);
      const updated = normalizeRoom(res.data);
      setRooms((prev) => prev.map((item) => (item.id === room.id ? updated : item)));
      setError("");
    } catch (err: unknown) {
      const typedErr = err as {
        response?: { data?: { message?: string | string[] } };
        message?: string;
      };
      const message = typedErr?.response?.data?.message;
      setError(
        Array.isArray(message)
          ? message.join(", ")
          : message || typedErr?.message || "ບໍ່ສາມາດອັບເດດສະຖານະຫ້ອງໄດ້",
      );
    } finally {
      setUpdatingRoomId("");
    }
  };

  return (
    <AdminRoute>
      <div className="admin-page">
        <div className="admin-page-container space-y-6">
          <PageHeader
            title="ຫ້ອງໂຫວດ"
            subtitle="ສ້າງ, ຕິດຕາມ ແລະ ຈັດການສະຖານະຫ້ອງໃນບ່ອນດຽວ"
            actions={
              <Link href="/admin/vote-rooms/create" className="admin-btn-primary">
                ສ້າງຫ້ອງ
              </Link>
            }
          />

          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <div className="admin-stat-card p-5">
              <p className="text-sm text-[var(--admin-text-muted)]">ທັງໝົດ</p>
              <p className="mt-2 text-3xl font-bold text-[var(--admin-text)]">{stats.total}</p>
            </div>
            <div className="admin-stat-card p-5">
              <p className="text-sm text-[var(--admin-text-muted)]">ເປີດ</p>
              <p className="mt-2 text-3xl font-bold text-[var(--admin-text)]">{stats.open}</p>
            </div>
            <div className="admin-stat-card p-5">
              <p className="text-sm text-[var(--admin-text-muted)]">ຮ່າງ</p>
              <p className="mt-2 text-3xl font-bold text-[var(--admin-text)]">{stats.draft}</p>
            </div>
            <div className="admin-stat-card p-5">
              <p className="text-sm text-[var(--admin-text-muted)]">ປິດ</p>
              <p className="mt-2 text-3xl font-bold text-[var(--admin-text)]">{stats.closed}</p>
            </div>
          </div>

          <div className="admin-card p-4">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <input
                type="text"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="ຄົ້ນຫາດ້ວຍຊື່ຫ້ອງ, ລະຫັດ ຫຼື ຄຳອະທິບາຍ"
                className="admin-input"
              />
              <select
                value={statusFilter}
                onChange={(event) =>
                  setStatusFilter(event.target.value as "all" | RoomStatus)
                }
                className="admin-select"
              >
                <option value="all">ທຸກສະຖານະ</option>
                <option value="draft">ຮ່າງ</option>
                <option value="open">ເປີດ</option>
                <option value="closed">ປິດ</option>
              </select>
              <button type="button" onClick={fetchRooms} className="admin-btn-secondary">
                ໂຫຼດຄືນ
              </button>
            </div>
          </div>

          {loading ? <LoadingState label="ກຳລັງໂຫຼດຫ້ອງ..." /> : null}

          {!loading && error ? (
            <ErrorState
              title="ໂຫຼດຫ້ອງບໍ່ສຳເລັດ"
              description={error}
              action={
                <button type="button" onClick={fetchRooms} className="admin-btn-primary">
                  ລອງອີກຄັ້ງ
                </button>
              }
            />
          ) : null}

          {!loading && !error && filteredRooms.length === 0 ? (
            <EmptyState
              title="ບໍ່ພົບຫ້ອງ"
              description={
                search || statusFilter !== "all"
                  ? "ລອງປັບຕົວກອງໃໝ່"
                  : "ສ້າງຫ້ອງທຳອິດເພື່ອເລີ່ມຈັດການການໂຫວດ"
              }
              action={
                <Link href="/admin/vote-rooms/create" className="admin-btn-primary">
                  ສ້າງຫ້ອງ
                </Link>
              }
            />
          ) : null}

          {!loading && !error && filteredRooms.length > 0 ? (
            <div className="admin-table-shell">
              <table className="min-w-full divide-y divide-[var(--admin-border)]">
                <thead className="admin-table-head">
                  <tr>
                    <th className="admin-table-header-cell px-4 py-3 text-left">ຫ້ອງ</th>
                    <th className="admin-table-header-cell px-4 py-3 text-left">ສະຖານະ</th>
                    <th className="admin-table-header-cell px-4 py-3 text-left">ອັບເດດ</th>
                    <th className="admin-table-header-cell px-4 py-3 text-right">ຈັດການ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--admin-border)]">
                  {filteredRooms.map((room) => (
                    <Fragment key={room.id}>
                      <tr className="admin-table-row">
                        <td className="px-4 py-4">
                          <div className="min-w-0 max-w-[30rem]">
                            <Link
                              href={`/admin/vote-rooms/${room.id}`}
                              title={`${compactText(room.roomName || "-")}\n${compactText(room.description || "")}`}
                              className="block truncate font-semibold text-slate-900 hover:text-[var(--admin-accent)]"
                            >
                              {compactText(room.roomName || "-")}
                            </Link>
                            <p className="truncate text-xs font-mono text-slate-400">
                              {room.roomCode || "-"}
                            </p>
                          </div>
                        </td>
                        <td className="px-4 py-4 align-top">
                          <StatusBadge
                            label={STATUS_LABELS[room.status] || room.status}
                            tone={statusTone(room.status)}
                          />
                        </td>
                        <td className="px-4 py-4 align-top text-sm text-slate-600">
                          {formatDate(room.updatedAt || room.createdAt)}
                        </td>
                        <td className="px-4 py-4 align-top">
                          <div className="flex items-center justify-end gap-2">
                            <Link
                              href={`/admin/vote-rooms/${room.id}`}
                              className="admin-icon-btn"
                              title="ເປີດລາຍລະອຽດ"
                            >
                              <Eye className="h-4 w-4" />
                            </Link>
                            <button
                              type="button"
                              onClick={() =>
                                setExpandedRoomId((current) =>
                                  current === room.id ? "" : room.id,
                                )
                              }
                              className="admin-icon-btn"
                              title={
                                expandedRoomId === room.id
                                  ? "ເຊື່ອງປຸ່ມດ່ວນ"
                                  : "ສະແດງປຸ່ມດ່ວນ"
                              }
                            >
                              {expandedRoomId === room.id ? (
                                <ChevronUp className="h-4 w-4" />
                              ) : (
                                <ChevronDown className="h-4 w-4" />
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleDeleteRoom(room)}
                              disabled={deletingRoomId === room.id}
                              className="admin-icon-btn-danger"
                              title="ລົບຫ້ອງ"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>

                      {expandedRoomId === room.id ? (
                        <tr className="bg-[var(--admin-surface-muted)]">
                          <td colSpan={4} className="px-4 pb-4 pt-0">
                            <div className="border-t border-[var(--admin-border)] pt-4">
                              <div className="space-y-4">
                                <div>
                                  <p className="text-sm font-semibold text-[var(--admin-text)]">
                                    ຄຳສັ່ງດ່ວນ
                                  </p>
                                  <div className="mt-3 flex flex-wrap gap-2">
                                    <button
                                      type="button"
                                      onClick={() => void handleUpdateStatus(room, "draft")}
                                      disabled={
                                        updatingRoomId === room.id ||
                                        room.status === "draft"
                                      }
                                      className="admin-btn-secondary rounded-full px-3 py-1.5 text-xs"
                                    >
                                      <FilePenLine className="h-3.5 w-3.5" />
                                      ປ່ຽນເປັນຮ່າງ
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => void handleUpdateStatus(room, "open")}
                                      disabled={
                                        updatingRoomId === room.id ||
                                        room.status === "open"
                                      }
                                      className="admin-btn-secondary rounded-full border-emerald-200 px-3 py-1.5 text-xs text-emerald-700 hover:bg-emerald-50"
                                    >
                                      <Play className="h-3.5 w-3.5" />
                                      ເປີດຫ້ອງ
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => void handleUpdateStatus(room, "closed")}
                                      disabled={
                                        updatingRoomId === room.id ||
                                        room.status === "closed"
                                      }
                                      className="admin-btn-secondary rounded-full border-amber-200 px-3 py-1.5 text-xs text-amber-700 hover:bg-amber-50"
                                    >
                                      <Lock className="h-3.5 w-3.5" />
                                      ປິດຫ້ອງ
                                    </button>
                                  </div>
                                </div>

                                <div>
                                  <p className="text-sm font-semibold text-[var(--admin-text)]">
                                    ຂໍ້ມູນປັດຈຸບັນ
                                  </p>
                                  <dl className="mt-2 grid gap-2 text-sm text-slate-600 sm:grid-cols-3">
                                    <div className="admin-card-muted px-3 py-2">
                                      <dt className="text-xs text-slate-500">ສ້າງເມື່ອ</dt>
                                      <dd className="mt-1 font-medium text-slate-800">
                                        {formatDate(room.createdAt)}
                                      </dd>
                                    </div>
                                    <div className="admin-card-muted px-3 py-2">
                                      <dt className="text-xs text-slate-500">ອັບເດດ</dt>
                                      <dd className="mt-1 font-medium text-slate-800">
                                        {formatDate(room.updatedAt)}
                                      </dd>
                                    </div>
                                    <div className="admin-card-muted px-3 py-2">
                                      <dt className="text-xs text-slate-500">ຜູ້ສະໝັກ</dt>
                                      <dd className="mt-1 font-medium text-slate-800">
                                        {room.candidates.length}
                                      </dd>
                                    </div>
                                  </dl>
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
      </div>
    </AdminRoute>
  );
}
