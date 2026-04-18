"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ChartColumnBig,
  CircleCheckBig,
  FileSpreadsheet,
  UsersRound,
} from "lucide-react";

import AdminRoute from "../../../components/AdminRoute";
import { acquireSocket, joinSocketRoom, leaveSocketRoom, releaseSocket } from "../../../api/socketClient";
import apiClient from "../../../lib/apiClient";
import { formatLaoDateTime } from "../../../lib/formatLaoDate";
import { useAdminAuthStore } from "../../../store/adminAuthStore";
import PageHeader from "../../../components/ui/PageHeader";
import type { VoteRoom } from "../../../types";

interface AdminRoom extends VoteRoom {
  id: string;
  createdAt?: string;
  updatedAt?: string;
}

function normalizeRoom(room: unknown): AdminRoom {
  const item = room as Record<string, unknown>;
  return {
    id: String(item.id || item._id || ""),
    roomCode: String(item.roomCode || ""),
    roomName: String(item.roomName || ""),
    description: String(item.description || ""),
    startTime: item.startTime ? String(item.startTime) : null,
    endTime: item.endTime ? String(item.endTime) : null,
    timeMode: item.timeMode === "range" ? "range" : "duration",
    durationMinutes:
      typeof item.durationMinutes === "number" ? item.durationMinutes : undefined,
    voteType:
      item.voteType === "single"
        ? "single"
        : item.voteType === "option"
          ? "option"
          : "multi",
    maxSelection: typeof item.maxSelection === "number" ? item.maxSelection : 1,
    status: item.status === "open" || item.status === "closed" ? item.status : "draft",
    allowResultView: Boolean(item.allowResultView),
    candidates: Array.isArray(item.candidates) ? item.candidates : [],
    allowedUsers: Array.isArray(item.allowedUsers) ? item.allowedUsers : [],
    ownerAdminId: String(item.ownerAdminId || ""),
    createdAt: item.createdAt ? String(item.createdAt) : undefined,
    updatedAt: item.updatedAt ? String(item.updatedAt) : undefined,
  };
}

function formatDate(value?: string): string {
  return formatLaoDateTime(value, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export default function AdminDashboardPage() {
  const adminId = useAdminAuthStore((state) => state.adminUser?.id || "");
  const [rooms, setRooms] = useState<AdminRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const reloadTimerRef = useRef<number | null>(null);

  useEffect(() => {
    async function fetchRooms() {
      try {
        const res = await apiClient.get("/rooms");
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
    }

    void fetchRooms();
  }, []);

  const refreshRooms = useCallback(async () => {
    try {
      const res = await apiClient.get("/rooms");
      const mapped = Array.isArray(res.data) ? res.data.map(normalizeRoom) : [];
      setRooms(mapped);
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
          : message || typedErr?.message || "ບໍ່ສາມາດຟື້ນໂຫຼດຫ້ອງໄດ້",
      );
    }
  }, []);

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
        void refreshRooms();
        reloadTimerRef.current = null;
      }, 300);
    };

    socket.on("rooms:status-changed", scheduleReload);

    return () => {
      socket.off("rooms:status-changed", scheduleReload);
      leaveSocketRoom(adminScope);
      if (ownerScope) {
        leaveSocketRoom(ownerScope);
      }
      releaseSocket();
    };
  }, [adminId, refreshRooms]);

  useEffect(() => {
    return () => {
      if (reloadTimerRef.current) {
        window.clearTimeout(reloadTimerRef.current);
      }
    };
  }, []);

  const stats = useMemo(() => {
    const openRooms = rooms.filter((room) => room.status === "open").length;
    const closedRooms = rooms.filter((room) => room.status === "closed").length;
    const draftRooms = rooms.filter((room) => room.status === "draft").length;
    const totalCandidates = rooms.reduce(
      (sum, room) => sum + (room.candidates?.length || 0),
      0,
    );
    return {
      totalRooms: rooms.length,
      openRooms,
      closedRooms,
      draftRooms,
      totalCandidates,
    };
  }, [rooms]);

  const recentRooms = useMemo(() => rooms.slice(0, 6), [rooms]);

  const statCards = [
    {
      label: "ຫ້ອງທັງໝົດ",
      value: stats.totalRooms,
      icon: ChartColumnBig,
      tone: "text-[var(--admin-accent)] bg-[var(--admin-accent-soft)]",
    },
    {
      label: "ກຳລັງເປີດ",
      value: stats.openRooms,
      icon: CircleCheckBig,
      tone: "text-emerald-700 bg-emerald-50",
    },
    {
      label: "ຫ້ອງຮ່າງ",
      value: stats.draftRooms,
      icon: FileSpreadsheet,
      tone: "text-amber-700 bg-amber-50",
    },
    {
      label: "ຜູ້ສະໝັກ",
      value: stats.totalCandidates,
      icon: UsersRound,
      tone: "text-slate-700 bg-slate-100",
    },
  ];

  return (
    <AdminRoute>
      <div className="admin-page">
        <div className="admin-page-container space-y-6">
          <PageHeader
            title="ພາບລວມລະບົບ"
            actions={
              <Link href="/admin/vote-rooms/create" className="admin-btn-primary">
                ສ້າງຫ້ອງ
              </Link>
            }
          />

          {loading ? (
            <div className="admin-card px-6 py-12 text-center text-sm text-[var(--admin-text-muted)]">
              ກຳລັງໂຫຼດຂໍ້ມູນສະຫຼຸບ...
            </div>
          ) : error ? (
            <div className="admin-notice-danger">{error}</div>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                {statCards.map((card) => {
                  const Icon = card.icon;
                  return (
                    <div key={card.label} className="admin-stat-card p-5">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-sm text-[var(--admin-text-muted)]">
                            {card.label}
                          </p>
                          <p className="mt-3 text-3xl font-bold tracking-tight text-[var(--admin-text)]">
                            {card.value}
                          </p>
                        </div>
                        <div
                          className={`flex h-11 w-11 items-center justify-center rounded-2xl ${card.tone}`}
                        >
                          <Icon className="h-5 w-5" />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="grid gap-6">
                <div className="admin-table-shell">
                  <div className="flex items-center justify-between border-b border-[var(--admin-border)] px-6 py-4">
                    <div>
                      <h2 className="text-lg font-semibold text-[var(--admin-text)]">
                        ຫ້ອງຫຼ້າສຸດ
                      </h2>
                    </div>
                    <Link href="/admin/vote-rooms" className="admin-btn-secondary">
                      ເບິ່ງທັງໝົດ
                    </Link>
                  </div>

                  {recentRooms.length === 0 ? (
                    <div className="px-6 py-14 text-center text-sm text-[var(--admin-text-muted)]">
                      ຍັງບໍ່ມີຫ້ອງ
                    </div>
                  ) : (
                    <table className="min-w-full divide-y divide-[var(--admin-border)]">
                      <thead className="admin-table-head">
                        <tr>
                          <th className="admin-table-header-cell px-6 py-3 text-left">
                            ຫ້ອງ
                          </th>
                          <th className="admin-table-header-cell px-6 py-3 text-left">
                            ລະຫັດ
                          </th>
                          <th className="admin-table-header-cell px-6 py-3 text-left">
                            ສະຖານະ
                          </th>
                          <th className="admin-table-header-cell px-6 py-3 text-left">
                            ອັບເດດ
                          </th>
                          <th className="admin-table-header-cell px-6 py-3 text-right">
                            ຈັດການ
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--admin-border)]">
                        {recentRooms.map((room) => (
                          <tr key={room.id} className="admin-table-row">
                            <td className="px-6 py-4">
                              <p className="font-medium text-[var(--admin-text)]">
                                {room.roomName || "-"}
                              </p>
                              {room.description ? (
                                <p className="mt-1 line-clamp-1 text-sm text-[var(--admin-text-muted)]">
                                  {room.description}
                                </p>
                              ) : null}
                            </td>
                            <td className="px-6 py-4 font-mono text-sm text-[var(--admin-text-muted)]">
                              {room.roomCode || "-"}
                            </td>
                            <td className="px-6 py-4 text-sm capitalize text-[var(--admin-text)]">
                              {room.status}
                            </td>
                            <td className="px-6 py-4 text-sm text-[var(--admin-text-muted)]">
                              {formatDate(room.updatedAt || room.createdAt)}
                            </td>
                            <td className="px-6 py-4 text-right">
                              <Link
                                href={`/admin/vote-rooms/${room.id}`}
                                className="admin-btn-secondary"
                              >
                                ເປີດ
                              </Link>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </AdminRoute>
  );
}
