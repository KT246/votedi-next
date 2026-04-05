"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import apiClient from '../api/apiClient';
import { useAuthStore } from '../store/authStore';
import { useVoteRoomStore } from '../store/voteRoomStore';
import ForceChangePasswordModal from '../components/ForceChangePasswordModal';
import LoadingState from '../components/ui/LoadingState';
import EmptyState from '../components/ui/EmptyState';
import ErrorState from '../components/ui/ErrorState';
import StatusBadge from '../components/ui/StatusBadge';
import { acquireSocket, joinSocketRoom, leaveSocketRoom, releaseSocket } from '../api/socketClient';
import { onAvatarError, toDisplayAvatarUrl } from '../utils/avatar';

const STATUS_LABELS: Record<string, string> = {
    open: 'ເປີດ',
    closed: 'ປິດ',
    draft: 'ຮ່າງ',
};

interface Room {
    id: string;
    roomCode: string;
    roomName: string;
    description: string;
    status: 'draft' | 'pending' | 'open' | 'closed';
    ownerAdminId?: string;
}

function normalizeStatus(value: unknown): Room['status'] {
    const normalized = String(value || '').trim().toLowerCase().replace(/[^a-z]/g, '');
    if (normalized === 'draft' || normalized === 'open' || normalized === 'closed') {
        return normalized;
    }
    return 'draft';
}

function normalizeRoomId(raw: unknown): string {
    if (!raw) return '';
    if (typeof raw === 'string') return raw.trim();
    if (typeof raw === 'number') return String(raw);
    if (typeof raw === 'object') {
        const maybe = raw as { $oid?: unknown; id?: unknown; _id?: unknown; toString?: () => string };
        if (typeof maybe.$oid === 'string') return maybe.$oid;
        if (typeof maybe.id === 'string') return maybe.id;
        if (typeof maybe._id === 'string') return maybe._id;
        if (typeof maybe.toString === 'function') {
            const value = maybe.toString();
            if (value && value !== '[object Object]') return value;
        }
    }
    return String(raw);
}

type StatusFilter = 'all' | Room['status'];

function getRoomHref(room: Room): string {
    if (room.status === 'closed') {
        return `/vote-room/${room.roomCode}/result`;
    }

    return `/vote-room/${room.roomCode}`;
}

function toBadgeTone(status: Room['status']): 'info' | 'warning' | 'success' | 'neutral' {
    if (status === 'open') return 'success';
    if (status === 'draft') return 'info';
    return 'neutral';
}

export default function MyRoomsPage() {
    const router = useRouter();
    const user = useAuthStore((state) => state.currentUser);
    const logout = useAuthStore((state) => state.logout);
    const [mounted, setMounted] = useState(false);

    const [rooms, setRooms] = useState<Room[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [showChangePassword, setShowChangePassword] = useState(false);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
    const reloadTimerRef = useRef<number | null>(null);
    const prefetchedRoomsRef = useRef(new Set<string>());

    const fetchMyRooms = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const res = await apiClient.get('/rooms/my-rooms');
            const mapped = (res.data || []).map((room: unknown) => {
                const item = room as {
                    id?: unknown;
                    _id?: unknown;
                    ownerAdminId?: unknown;
                    status?: unknown;
                    [key: string]: unknown;
                };
                return {
                    ...item,
                    id: normalizeRoomId(item.id ?? item._id),
                    ownerAdminId: normalizeRoomId(item.ownerAdminId),
                    status: normalizeStatus(item.status),
                };
            });
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
        void fetchMyRooms();
    }, [fetchMyRooms]);

    useEffect(() => {
        setMounted(true);
    }, []);

    useEffect(() => {
        const roomIds = Array.from(new Set(rooms.map((room) => normalizeRoomId(room.id)).filter(Boolean)));
        const ownerScopeId =
            normalizeRoomId(user?.createdByAdminId) ||
            normalizeRoomId((rooms[0] as { ownerAdminId?: unknown } | undefined)?.ownerAdminId);
        const ownerScopeChannel = ownerScopeId ? `owner:${ownerScopeId}` : '';
        if (roomIds.length === 0 && !ownerScopeId) return;

        const socket = acquireSocket();
        if (!socket) return;
        roomIds.forEach((id) => joinSocketRoom(id));
        if (ownerScopeChannel) {
            joinSocketRoom(ownerScopeChannel);
        }

        const scheduleReload = () => {
            if (reloadTimerRef.current) {
                window.clearTimeout(reloadTimerRef.current);
            }
            reloadTimerRef.current = window.setTimeout(() => {
                void fetchMyRooms();
                reloadTimerRef.current = null;
            }, 300);
        };

        const handleRoomStatusChanged = (payload: { roomId?: unknown }) => {
            const changedRoomId = normalizeRoomId(payload?.roomId);
            if (!changedRoomId || !roomIds.includes(changedRoomId)) return;
            scheduleReload();
        };

        const handleRoomsStatusChanged = (payload: { ownerAdminId?: unknown; roomId?: unknown }) => {
            const changedOwnerId = normalizeRoomId(payload?.ownerAdminId);
            if (ownerScopeId && changedOwnerId && changedOwnerId !== ownerScopeId) return;
            const changedRoomId = normalizeRoomId(payload?.roomId);
            if (!ownerScopeId && changedRoomId && !roomIds.includes(changedRoomId)) return;
            scheduleReload();
        };

        socket.on('room:status-changed', handleRoomStatusChanged);
        socket.on('rooms:status-changed', handleRoomsStatusChanged);

        return () => {
            socket.off('room:status-changed', handleRoomStatusChanged);
            socket.off('rooms:status-changed', handleRoomsStatusChanged);
            roomIds.forEach((id) => leaveSocketRoom(id));
            if (ownerScopeChannel) {
                leaveSocketRoom(ownerScopeChannel);
            }
            releaseSocket();
        };
    }, [rooms, fetchMyRooms, user?.createdByAdminId]);

    useEffect(() => {
        return () => {
            if (reloadTimerRef.current) {
                window.clearTimeout(reloadTimerRef.current);
            }
        };
    }, []);

    const filteredRooms = useMemo(() => {
        const q = search.trim().toLowerCase();
        return rooms.filter((room) => {
            if (statusFilter !== 'all' && room.status !== statusFilter) return false;
            if (!q) return true;
            const inName = room.roomName.toLowerCase().includes(q);
            const inCode = room.roomCode.toLowerCase().includes(q);
            const inDesc = (room.description || '').toLowerCase().includes(q);
            return inName || inCode || inDesc;
        });
    }, [rooms, search, statusFilter]);

    const statusFilters: Array<{ value: StatusFilter; label: string }> = [
        { value: 'all', label: 'ທັງໝົດ' },
        { value: 'open', label: 'ເປີດ' },
        { value: 'draft', label: 'ຮ່າງ' },
        { value: 'closed', label: 'ປິດ' },
    ];

    const handleLogout = async () => {
        try {
            await apiClient.post('/auth/logout');
        } catch {
            // Ignore API logout errors; always clear local session on client.
        } finally {
            logout();
            router.push('/');
        }
    };

    const prefetchRoomEntry = useCallback((room: Room) => {
        const href = getRoomHref(room);
        if (prefetchedRoomsRef.current.has(href)) return;

        prefetchedRoomsRef.current.add(href);
        router.prefetch(href);

        if (room.status !== 'closed') {
            void useVoteRoomStore.getState().loadRoom(room.roomCode, { silent: true });
        }
    }, [router]);

    return (
        <div className="min-h-screen bg-slate-50">
            <div className="mx-auto w-full max-w-5xl px-4 py-6">
                <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <h1 className="text-2xl font-extrabold text-slate-900">{'ຫ້ອງເລືອກຕັ້ງຂອງຂ້ອຍ'}</h1>
                        {mounted ? (
                            <div className="mt-2 flex items-center gap-3">
                                <img
                                    src={toDisplayAvatarUrl(user?.avatar, user?.fullName || user?.username || 'user')}
                                    alt={user?.fullName || user?.username || 'user'}
                                    onError={(event) => onAvatarError(event, user?.fullName || user?.username || 'user')}
                                    className="h-11 w-11 rounded-2xl border border-slate-200 object-cover bg-slate-100"
                                />
                                <p className="text-sm text-slate-500">
                                    {`ຍິນດີຕ້ອນຮັບ, ${user?.fullName || user?.username || '-'}`}
                                </p>
                            </div>
                        ) : (
                            <p className="mt-1 text-sm text-slate-500">{'ຍິນດີຕ້ອນຮັບ'}</p>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setShowChangePassword(true)}
                            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
                        >
                            {'ປ່ຽນລະຫັດຜ່ານ'}
                        </button>
                        <button
                            onClick={handleLogout}
                            className="rounded-xl border border-rose-200 bg-white px-3 py-2 text-sm font-medium text-rose-600 transition-colors hover:bg-rose-50"
                        >
                            {'ອອກຈາກລະບົບ'}
                        </button>
                    </div>
                </div>

                <div className="mb-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="mb-3 flex flex-wrap gap-2">
                        {statusFilters.map((filter) => (
                            <button
                                key={filter.value}
                                onClick={() => setStatusFilter(filter.value)}
                                className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                                    statusFilter === filter.value
                                        ? 'border-indigo-200 bg-indigo-50 text-indigo-700'
                                        : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'
                                }`}
                            >
                                {filter.label}
                            </button>
                        ))}
                    </div>
                    <input
                        type="text"
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        placeholder={'ຄົ້ນຫາດ້ວຍຊື່ຫ້ອງ ຫຼື ລະຫັດຫ້ອງ'}
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 focus:border-indigo-300 focus:bg-white focus:outline-none"
                    />
                </div>

                {loading ? <LoadingState label={'ກຳລັງໂຫຼດຫ້ອງ...'} /> : null}

                {!loading && error ? (
                    <ErrorState
                        title={'ບໍ່ສາມາດໂຫຼດຫ້ອງໄດ້'}
                        description={error}
                        action={
                            <button
                                onClick={fetchMyRooms}
                                className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-indigo-700"
                            >
                                {'ລອງອີກຄັ້ງ'}
                            </button>
                        }
                    />
                ) : null}

                {!loading && !error && filteredRooms.length === 0 ? (
                    <EmptyState
                        title={'ຍັງບໍ່ມີຫ້ອງເລືອກຕັ້ງ'}
                        description={'ທ່ານຍັງບໍ່ມີຊື່ໃນຫ້ອງໃດເທື່ອ'}
                        action={
                            search || statusFilter !== 'all' ? (
                                <button
                                    onClick={() => {
                                        setSearch('');
                                        setStatusFilter('all');
                                    }}
                                    className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50"
                                >
                                    {'ລ້າງຕົວກອງ'}
                                </button>
                            ) : undefined
                        }
                    />
                ) : null}

                {!loading && !error && filteredRooms.length > 0 ? (
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                        {filteredRooms.map((room) => (
                            <Link
                                key={room.id}
                                href={getRoomHref(room)}
                                prefetch={false}
                                onClick={() => prefetchRoomEntry(room)}
                                onMouseEnter={() => prefetchRoomEntry(room)}
                                onFocus={() => prefetchRoomEntry(room)}
                                onTouchStart={() => prefetchRoomEntry(room)}
                                className="rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm transition-colors hover:border-indigo-200 hover:bg-indigo-50/30"
                            >
                                <div className="mb-3 flex items-start justify-between gap-2">
                                    <h3 className="text-base font-bold text-slate-900">{room.roomName}</h3>
                                    <StatusBadge label={STATUS_LABELS[room.status]} tone={toBadgeTone(room.status)} />
                                </div>
                                <p className="line-clamp-2 min-h-[40px] text-sm text-slate-500">{room.description}</p>
                                <p className="mt-3 text-xs font-mono text-slate-500">
                                    {'ລະຫັດຫ້ອງ'}: {room.roomCode}
                                </p>
                            </Link>
                        ))}
                    </div>
                ) : null}
            </div>

            {showChangePassword ? (
                <ForceChangePasswordModal required={false} onClose={() => setShowChangePassword(false)} />
            ) : null}
        </div>
    );
}

