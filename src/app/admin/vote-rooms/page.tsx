"use client";

import Link from 'next/link';
import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, Eye, FilePenLine, Lock, Play, Trash2 } from 'lucide-react';

import AdminRoute from '../../../components/AdminRoute';
import EmptyState from '../../../components/ui/EmptyState';
import ErrorState from '../../../components/ui/ErrorState';
import LoadingState from '../../../components/ui/LoadingState';
import StatusBadge from '../../../components/ui/StatusBadge';
import { roomsApi } from '../../../api/roomsApi';
import type { VoteRoom } from '../../../types';

type RoomStatus = VoteRoom['status'];

interface AdminRoom extends VoteRoom {
    id: string;
    ownerAdminId?: string;
    createdAt?: string;
    updatedAt?: string;
}

const STATUS_LABELS: Partial<Record<RoomStatus, string>> = {
    draft: 'ຮ່າງ',
    open: 'ເປີດ',
    closed: 'ປິດ',
};

function normalizeRoomId(value: unknown): string {
    if (!value) return '';
    if (typeof value === 'string') return value.trim();
    if (typeof value === 'number') return String(value);
    if (typeof value === 'object') {
        const raw = value as { $oid?: unknown; id?: unknown; _id?: unknown; toString?: () => string };
        if (typeof raw.$oid === 'string') return raw.$oid;
        if (typeof raw.id === 'string') return raw.id;
        if (typeof raw._id === 'string') return raw._id;
        if (typeof raw.toString === 'function') {
            const result = raw.toString();
            if (result && result !== '[object Object]') return result;
        }
    }
    return String(value);
}

function normalizeStatus(value: unknown): RoomStatus {
    const raw = String(value || '').trim().toLowerCase().replace(/[^a-z]/g, '');
    if (raw === 'draft' || raw === 'pending' || raw === 'open' || raw === 'closed') {
        if (raw === 'pending') return 'draft';
        return raw;
    }
    return 'draft';
}

function normalizeRoom(room: unknown): AdminRoom {
    const item = room as Record<string, unknown>;
    return {
        id: normalizeRoomId(item.id ?? item._id),
        roomCode: String(item.roomCode || ''),
        roomName: String(item.roomName || ''),
        description: String(item.description || ''),
        startTime: item.startTime ? String(item.startTime) : null,
        endTime: item.endTime ? String(item.endTime) : null,
        timeMode: item.timeMode === 'duration' ? 'duration' : 'range',
        durationMinutes: typeof item.durationMinutes === 'number' ? item.durationMinutes : undefined,
        voteType: item.voteType === 'multi' || item.voteType === 'option' ? item.voteType : 'single',
        maxSelection: typeof item.maxSelection === 'number' ? item.maxSelection : 1,
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
    return value.replace(/\s+/g, ' ').trim();
}

function statusTone(status: RoomStatus): 'info' | 'warning' | 'success' | 'neutral' {
    if (status === 'open') return 'success';
    if (status === 'draft') return 'info';
    return 'neutral';
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

export default function AdminVoteRoomsPage() {
    const [rooms, setRooms] = useState<AdminRoom[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState<'all' | RoomStatus>('all');
    const [deletingRoomId, setDeletingRoomId] = useState('');
    const [updatingRoomId, setUpdatingRoomId] = useState('');
    const [expandedRoomId, setExpandedRoomId] = useState('');

    const fetchRooms = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const res = await roomsApi.getAll();
            const mapped = Array.isArray(res.data) ? res.data.map(normalizeRoom) : [];
            setRooms(mapped);
        } catch (err: unknown) {
            const typedErr = err as { response?: { data?: { message?: string | string[] } }; message?: string };
            const message = typedErr?.response?.data?.message;
            setError(Array.isArray(message) ? message.join(', ') : message || typedErr?.message || 'ບໍ່ສາມາດໂຫຼດຫ້ອງໄດ້');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void fetchRooms();
    }, [fetchRooms]);

    const filteredRooms = useMemo(() => {
        const q = search.trim().toLowerCase();
        return rooms.filter((room) => {
            if (statusFilter !== 'all' && room.status !== statusFilter) return false;
            if (!q) return true;
            return (
                room.roomName.toLowerCase().includes(q) ||
                room.roomCode.toLowerCase().includes(q) ||
                room.description.toLowerCase().includes(q)
            );
        });
    }, [rooms, search, statusFilter]);

    const stats = useMemo(
        () => ({
            total: rooms.length,
            open: rooms.filter((room) => room.status === 'open').length,
            draft: rooms.filter((room) => room.status === 'draft').length,
            closed: rooms.filter((room) => room.status === 'closed').length,
        }),
        [rooms]
    );

    const handleDeleteRoom = async (room: AdminRoom) => {
        const confirmed = window.confirm(`ຕ້ອງການລຶບຫ້ອງ "${room.roomName}" ຫຼືບໍ?`);
        if (!confirmed) return;

        setDeletingRoomId(room.id);
        try {
            await roomsApi.delete(room.id);
            setRooms((prev) => prev.filter((item) => item.id !== room.id));
        } catch (err: unknown) {
            const typedErr = err as { response?: { data?: { message?: string | string[] } }; message?: string };
            const message = typedErr?.response?.data?.message;
            setError(Array.isArray(message) ? message.join(', ') : message || typedErr?.message || 'ບໍ່ສາມາດລຶບຫ້ອງໄດ້');
        } finally {
            setDeletingRoomId('');
        }
    };

    const handleUpdateStatus = async (room: AdminRoom, status: RoomStatus) => {
        if (room.status === status) return;

        if (room.status === 'closed' && (status === 'open' || status === 'draft')) {
            const confirmed = window.confirm(
                'ຫ້ອງນີ້ປິດແລ້ວ. ຖ້າປ່ຽນກັບໄປ ເປີດ ຫຼື ຮ່າງ ຜົນຄະແນນເກົ່າຈະຖືກລົບອອກ ແລະຫ້ອງຈະຖືກຕັ້ງໃໝ່.',
            );
            if (!confirmed) return;
        }

        setUpdatingRoomId(room.id);
        try {
            const res = await roomsApi.updateStatus(room.id, status);
            const updated = normalizeRoom(res.data);
            setRooms((prev) => prev.map((item) => (item.id === room.id ? updated : item)));
            setError('');
        } catch (err: unknown) {
            const typedErr = err as { response?: { data?: { message?: string | string[] } }; message?: string };
            const message = typedErr?.response?.data?.message;
            setError(Array.isArray(message) ? message.join(', ') : message || typedErr?.message || 'ບໍ່ສາມາດປ່ຽນສະຖານະໄດ້');
        } finally {
            setUpdatingRoomId('');
        }
    };

    return (
        <AdminRoute>
            <div className="min-h-screen bg-slate-50 p-6">
                <div className="mx-auto max-w-7xl">
                    <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
                        <div>
                            <h1 className="text-2xl font-bold text-slate-900">ຈັດການຫ້ອງ</h1>
                            <p className="text-slate-500">ລາຍການຫ້ອງ vote ທັງໝົດໃນລະບົບ</p>
                        </div>
                        <Link
                            href="/admin/vote-rooms/create"
                            className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-indigo-700"
                        >
                            ສ້າງຫ້ອງໃໝ່
                        </Link>
                    </div>

                    <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-4">
                        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                            <p className="text-sm text-slate-500">ຈຳນວນຫ້ອງທັງໝົດ</p>
                            <p className="mt-2 text-3xl font-bold text-slate-900">{stats.total}</p>
                        </div>
                        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                            <p className="text-sm text-slate-500">ກຳລັງເປີດ</p>
                            <p className="mt-2 text-3xl font-bold text-slate-900">{stats.open}</p>
                        </div>
                        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                            <p className="text-sm text-slate-500">ຮ່າງ</p>
                            <p className="mt-2 text-3xl font-bold text-slate-900">{stats.draft}</p>
                        </div>
                        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                            <p className="text-sm text-slate-500">ປິດແລ້ວ</p>
                            <p className="mt-2 text-3xl font-bold text-slate-900">{stats.closed}</p>
                        </div>
                    </div>

                    <div className="mb-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                            <input
                                type="text"
                                value={search}
                                onChange={(event) => setSearch(event.target.value)}
                                placeholder="ຄົ້ນຫາຕາມຊື່, ລະຫັດຫ້ອງ, ຫຼື ຄຳອະທິບາຍ"
                                className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 focus:border-indigo-300 focus:bg-white focus:outline-none"
                            />
                            <select
                                value={statusFilter}
                                onChange={(event) => setStatusFilter(event.target.value as 'all' | RoomStatus)}
                                className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 focus:border-indigo-300 focus:bg-white focus:outline-none"
                            >
                                <option value="all">ສະຖານະທັງໝົດ</option>
                                <option value="draft">ຮ່າງ</option>
                                <option value="open">ເປີດ</option>
                                <option value="closed">ປິດ</option>
                            </select>
                            <button
                                onClick={fetchRooms}
                                className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
                            >
                                ໂຫຼດໃໝ່
                            </button>
                        </div>
                    </div>

                    {loading ? <LoadingState label="ກຳລັງໂຫຼດລາຍການຫ້ອງ..." /> : null}

                    {!loading && error ? (
                        <ErrorState
                            title="ໂຫຼດຫ້ອງບໍ່ສຳເລັດ"
                            description={error}
                            action={
                                <button
                                    onClick={fetchRooms}
                                    className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-indigo-700"
                                >
                                    ລອງອີກຄັ້ງ
                                </button>
                            }
                        />
                    ) : null}

                    {!loading && !error && filteredRooms.length === 0 ? (
                        <EmptyState
                            title="ຍັງບໍ່ມີຫ້ອງ"
                            description={
                                search || statusFilter !== 'all'
                                    ? 'ບໍ່ພົບຫ້ອງທີ່ກົງກັບຕົວກອງ.'
                                    : 'ສ້າງຫ້ອງທຳອິດເພື່ອເລີ່ມຈັດການ.'
                            }
                            action={
                                <Link
                                    href="/admin/vote-rooms/create"
                                    className="inline-flex rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-indigo-700"
                                >
                                    ສ້າງຫ້ອງໃໝ່
                                </Link>
                            }
                        />
                    ) : null}

                    {!loading && !error && filteredRooms.length > 0 ? (
                        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                            <table className="min-w-full divide-y divide-slate-200">
                                <thead className="bg-slate-50">
                                    <tr>
                                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">ຫ້ອງ</th>
                                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">ສະຖານະ</th>
                                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">ອັບເດດຫຼ້າສຸດ</th>
                                        <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">ການກະທຳ</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-200">
                                    {filteredRooms.map((room) => (
                                        <Fragment key={room.id}>
                                        <tr key={room.id} className="hover:bg-slate-50/70">
                                            <td className="px-4 py-4">
                                                <div className="min-w-0 max-w-[28rem]">
                                                    <Link
                                                        href={`/admin/vote-rooms/${room.id}`}
                                                        title={`${compactText(room.roomName || '-')}\n${compactText(room.description || '')}\nລະຫັດຫ້ອງ: ${room.roomCode || '-'}`}
                                                        className="block truncate font-semibold text-slate-900 hover:text-indigo-600"
                                                    >
                                                        {compactText(room.roomName || '-')}
                                                    </Link>
                                                    <p className="truncate text-xs font-mono text-slate-400">
                                                        ລະຫັດຫ້ອງ: {room.roomCode || '-'}
                                                    </p>
                                                </div>
                                            </td>
                                            <td className="px-4 py-4 align-top">
                                                <StatusBadge label={STATUS_LABELS[room.status] || room.status} tone={statusTone(room.status)} />
                                            </td>
                                            <td className="px-4 py-4 align-top text-sm text-slate-600">
                                                {formatDate(room.updatedAt || room.createdAt)}
                                            </td>
                    <td className="px-4 py-4 align-top text-sm text-slate-700">
                                                <div className="flex items-center justify-end gap-2">
                                                    <Link
                                                        href={`/admin/vote-rooms/${room.id}`}
                                                        className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white p-2 text-slate-700 transition-colors hover:bg-slate-50"
                                                        title="ເບິ່ງລາຍລະອຽດ"
                                                    >
                                                        <Eye className="h-4 w-4" />
                                                    </Link>
                                                    <button
                                                        onClick={() => setExpandedRoomId((current) => (current === room.id ? '' : room.id))}
                                                        className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white p-2 text-slate-700 transition-colors hover:bg-slate-50"
                                                        title={expandedRoomId === room.id ? 'ປິດລາຍລະອຽດ' : 'ເປີດລາຍລະອຽດ'}
                                                    >
                                                        {expandedRoomId === room.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                                    </button>
                                                    <button
                                                        onClick={() => void handleDeleteRoom(room)}
                                                        disabled={deletingRoomId === room.id}
                                                        className="inline-flex items-center justify-center rounded-xl border border-rose-200 bg-white p-2 text-rose-600 transition-colors hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                                                        title="ລຶບຫ້ອງ"
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                        {expandedRoomId === room.id ? (
                                            <tr className="bg-slate-50/70">
                                                <td colSpan={4} className="px-4 pb-4 pt-0">
                                                    <div className="border-t border-slate-200 pt-4">
                                                        <div className="space-y-4">
                                                            <div>
                                                                <p className="text-sm font-semibold text-slate-900">ການກະທຳດ່ວນ</p>
                                                                <div className="mt-3 flex flex-wrap gap-2">
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => void handleUpdateStatus(room, 'draft')}
                                                                        disabled={updatingRoomId === room.id || room.status === 'draft'}
                                                                        className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                                                                    >
                                                                        <FilePenLine className="h-3.5 w-3.5" />
                                                                        ປ່ຽນເປັນຮ່າງ
                                                                    </button>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => void handleUpdateStatus(room, 'open')}
                                                                        disabled={updatingRoomId === room.id || room.status === 'open'}
                                                                        className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-white px-3 py-1.5 text-xs font-medium text-emerald-700 transition-colors hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-60"
                                                                    >
                                                                        <Play className="h-3.5 w-3.5" />
                                                                        ເປີດຫ້ອງ
                                                                    </button>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => void handleUpdateStatus(room, 'closed')}
                                                                        disabled={updatingRoomId === room.id || room.status === 'closed'}
                                                                        className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-white px-3 py-1.5 text-xs font-medium text-amber-700 transition-colors hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-60"
                                                                    >
                                                                        <Lock className="h-3.5 w-3.5" />
                                                                        ປິດຫ້ອງ
                                                                    </button>
                                                                </div>
                                                            </div>

                                                            <div>
                                                                <p className="text-sm font-semibold text-slate-900">ຂໍ້ມູນປັດຈຸບັນ</p>
                                                                <dl className="mt-2 grid gap-2 text-sm text-slate-600 sm:grid-cols-3">
                                                                    <div className="rounded-xl bg-white px-3 py-2">
                                                                        <dt className="text-xs text-slate-500">ສ້າງເມື່ອ</dt>
                                                                        <dd className="mt-1 font-medium text-slate-800">{formatDate(room.createdAt)}</dd>
                                                                    </div>
                                                                    <div className="rounded-xl bg-white px-3 py-2">
                                                                        <dt className="text-xs text-slate-500">ອັບເດດລ່າສຸດ</dt>
                                                                        <dd className="mt-1 font-medium text-slate-800">{formatDate(room.updatedAt)}</dd>
                                                                    </div>
                                                                    <div className="rounded-xl bg-white px-3 py-2">
                                                                        <dt className="text-xs text-slate-500">ຈຳນວນ candidate</dt>
                                                                        <dd className="mt-1 font-medium text-slate-800">{room.candidates.length}</dd>
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
