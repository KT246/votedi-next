"use client";

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import AdminRoute from '../../../components/AdminRoute';
import { acquireSocket, joinSocketRoom, leaveSocketRoom, releaseSocket } from '../../../api/socketClient';
import apiClient from '../../../lib/apiClient';
import { useAdminAuthStore } from '../../../store/adminAuthStore';
import type { VoteRoom } from '../../../types';

interface AdminRoom extends VoteRoom {
    id: string;
    createdAt?: string;
    updatedAt?: string;
}

function normalizeRoom(room: unknown): AdminRoom {
    const item = room as Record<string, unknown>;
    return {
        id: String(item.id || item._id || ''),
        roomCode: String(item.roomCode || ''),
        roomName: String(item.roomName || ''),
        description: String(item.description || ''),
        startTime: item.startTime ? String(item.startTime) : null,
        endTime: item.endTime ? String(item.endTime) : null,
        timeMode: item.timeMode === 'range' ? 'range' : 'duration',
        durationMinutes: typeof item.durationMinutes === 'number' ? item.durationMinutes : undefined,
        voteType: item.voteType === 'single' ? 'single' : item.voteType === 'option' ? 'option' : 'multi',
        maxSelection: typeof item.maxSelection === 'number' ? item.maxSelection : 1,
        status: item.status === 'open' || item.status === 'closed' ? item.status : 'draft',
        allowResultView: Boolean(item.allowResultView),
        candidates: Array.isArray(item.candidates) ? item.candidates : [],
        allowedUsers: Array.isArray(item.allowedUsers) ? item.allowedUsers : [],
        ownerAdminId: String(item.ownerAdminId || ''),
        createdAt: item.createdAt ? String(item.createdAt) : undefined,
        updatedAt: item.updatedAt ? String(item.updatedAt) : undefined,
    };
}

function formatDate(value?: string): string {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return new Intl.DateTimeFormat('lo-LA', {
        dateStyle: 'medium',
        timeStyle: 'short',
    }).format(date);
}

export default function AdminDashboardPage() {
    const adminId = useAdminAuthStore((state) => state.adminUser?.id || '');
    const [rooms, setRooms] = useState<AdminRoom[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const reloadTimerRef = useRef<number | null>(null);

    useEffect(() => {
        async function fetchRooms() {
            try {
                const res = await apiClient.get('/rooms');
                const mapped = Array.isArray(res.data) ? res.data.map(normalizeRoom) : [];
                setRooms(mapped);
            } catch (err: unknown) {
                const typedErr = err as { response?: { data?: { message?: string | string[] } }; message?: string };
                const message = typedErr?.response?.data?.message;
                setError(Array.isArray(message) ? message.join(', ') : message || typedErr?.message || 'ບໍ່ສາມາດໂຫຼດຂໍ້ມູນຫ້ອງໄດ້');
            } finally {
                setLoading(false);
            }
        }

        void fetchRooms();
    }, []);

    const refreshRooms = useCallback(async () => {
        try {
            const res = await apiClient.get('/rooms');
            const mapped = Array.isArray(res.data) ? res.data.map(normalizeRoom) : [];
            setRooms(mapped);
            setError('');
        } catch (err: unknown) {
            const typedErr = err as { response?: { data?: { message?: string | string[] } }; message?: string };
            const message = typedErr?.response?.data?.message;
            setError(Array.isArray(message) ? message.join(', ') : message || typedErr?.message || 'ໂຫຼດຂໍ້ມູນຫ້ອງບໍ່ສຳເລັດ');
        }
    }, []);

    useEffect(() => {
        const socket = acquireSocket();
        if (!socket) return;

        const adminScope = 'admin:rooms';
        const ownerScope = adminId ? `owner:${adminId}` : '';
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

        socket.on('rooms:status-changed', scheduleReload);

        return () => {
            socket.off('rooms:status-changed', scheduleReload);
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
        const openRooms = rooms.filter((room) => room.status === 'open').length;
        const closedRooms = rooms.filter((room) => room.status === 'closed').length;
        const draftRooms = rooms.filter((room) => room.status === 'draft').length;
        const totalCandidates = rooms.reduce((sum, room) => sum + (room.candidates?.length || 0), 0);
        return { totalRooms: rooms.length, openRooms, closedRooms, draftRooms, totalCandidates };
    }, [rooms]);

    const recentRooms = useMemo(() => rooms.slice(0, 5), [rooms]);

    return (
        <AdminRoute>
            <div className="min-h-screen bg-slate-50 p-6">
                <div className="mx-auto max-w-7xl">
                    <div className="mb-8">
                        <h1 className="text-2xl font-bold text-slate-900">ແດຊບອດ</h1>
                        <p className="text-slate-500">ສະຫຼຸບຫ້ອງຂອງລະບົບ</p>
                    </div>

                    {loading ? (
                        <div className="py-12 text-center">
                            <p className="text-slate-500">ກຳລັງໂຫຼດຂໍ້ມູນຫ້ອງ...</p>
                        </div>
                    ) : error ? (
                        <div className="py-12 text-center">
                            <p className="text-rose-600">{error}</p>
                        </div>
                    ) : (
                        <>
                            <div className="grid grid-cols-1 gap-6 md:grid-cols-4">
                                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                                    <p className="text-sm text-slate-500">ຫ້ອງທັງໝົດ</p>
                                    <p className="mt-2 text-3xl font-bold text-slate-900">{stats.totalRooms}</p>
                                </div>
                                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                                    <p className="text-sm text-slate-500">ຫ້ອງເປີດ</p>
                                    <p className="mt-2 text-3xl font-bold text-slate-900">{stats.openRooms}</p>
                                </div>
                                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                                    <p className="text-sm text-slate-500">ຫ້ອງຮ່າງ</p>
                                    <p className="mt-2 text-3xl font-bold text-slate-900">{stats.draftRooms}</p>
                                </div>
                                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                                    <p className="text-sm text-slate-500">candidate ທັງໝົດ</p>
                                    <p className="mt-2 text-3xl font-bold text-slate-900">{stats.totalCandidates}</p>
                                </div>
                            </div>

                            <div className="mt-8 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                                <div className="border-b border-slate-200 px-6 py-4">
                                    <h2 className="text-lg font-semibold text-slate-900">ຫ້ອງລ່າສຸດ</h2>
                                </div>
                                {recentRooms.length === 0 ? (
                                    <div className="px-6 py-12 text-center text-slate-500">ຍັງບໍ່ມີຫ້ອງ</div>
                                ) : (
                                    <table className="min-w-full divide-y divide-slate-200">
                                        <thead className="bg-slate-50">
                                            <tr>
                                                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">ຊື່ຫ້ອງ</th>
                                                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">ລະຫັດ</th>
                                                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">ສະຖານະ</th>
                                                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">ອັບເດດລ່າສຸດ</th>
                                                <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">ຈັດການ</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-200">
                                            {recentRooms.map((room) => (
                                                <tr key={room.id} className="hover:bg-slate-50/70">
                                                    <td className="px-6 py-4 font-medium text-slate-900">{room.roomName || '-'}</td>
                                                    <td className="px-6 py-4 font-mono text-sm text-slate-500">{room.roomCode || '-'}</td>
                                                    <td className="px-6 py-4 text-sm text-slate-600">{room.status}</td>
                                                    <td className="px-6 py-4 text-sm text-slate-600">{formatDate(room.updatedAt || room.createdAt)}</td>
                                                    <td className="px-6 py-4 text-right">
                                                        <Link
                                                            href={`/admin/vote-rooms/${room.id}`}
                                                            className="inline-flex rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                                                        >
                                                            ເບິ່ງ
                                                        </Link>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                )}
                            </div>
                        </>
                    )}
                </div>
            </div>
        </AdminRoute>
    );
}
