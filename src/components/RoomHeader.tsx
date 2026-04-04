"use client";

import { useRouter } from 'next/navigation';
import apiClient from '../api/apiClient';
import { useAuthStore } from '../store/authStore';
import { useVoteRoomStore } from '../store/voteRoomStore';
import { VoteStatus } from '../types';
import { onAvatarError, toDisplayAvatarUrl } from '../utils/avatar';

const STATUS_LABELS: Record<string, string> = {
    status_open: 'ເປີດ',
    status_pending: 'ລໍຖ້າ',
    status_closed: 'ປິດ',
    status_draft: 'ຮ່າງ',
};

const STATUS_CONFIG: Record<VoteStatus, { labelKey: string; fallback: string; color: string; bg: string; dot: string }> = {
    open: { labelKey: 'status_open', fallback: 'Open', color: 'text-emerald-700', bg: 'bg-emerald-50', dot: 'bg-emerald-500' },
    pending: { labelKey: 'status_pending', fallback: 'Pending', color: 'text-amber-700', bg: 'bg-amber-50', dot: 'bg-amber-500' },
    closed: { labelKey: 'status_closed', fallback: 'Closed', color: 'text-slate-600', bg: 'bg-slate-100', dot: 'bg-slate-400' },
    draft: { labelKey: 'status_draft', fallback: 'Draft', color: 'text-indigo-700', bg: 'bg-indigo-50', dot: 'bg-indigo-500' },
};

function formatDateTime(value: string | null) {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return new Intl.DateTimeFormat('lo-LA', {
        dateStyle: 'short',
        timeStyle: 'short',
    }).format(date);
}

export default function RoomHeader() {
    const user = useAuthStore((state) => state.currentUser);
    const logout = useAuthStore((state) => state.logout);
    const roomInfo = useVoteRoomStore((state) => state.roomInfo);
    const resetRoom = useVoteRoomStore((state) => state.resetRoom);
    const router = useRouter();

    const status = roomInfo ? STATUS_CONFIG[roomInfo.status] || STATUS_CONFIG.closed : STATUS_CONFIG.closed;

    const handleLogout = async () => {
        try {
            await apiClient.post('/auth/logout');
        } catch {
            // Always clear the local session even if the server logout request fails.
        } finally {
            resetRoom();
            logout();
            router.push('/');
        }
    };

    if (!roomInfo) return null;

    return (
        <header className="sticky top-0 z-10 border-b border-slate-200 bg-white shadow-sm">
            <div className="mx-auto max-w-lg px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                        <h1 className="truncate text-base font-bold text-slate-900">{roomInfo.roomName}</h1>
                        <p className="mt-0.5 text-xs text-slate-500">
                            {'ລະຫັດຫ້ອງ'}: <span className="font-mono font-semibold text-slate-700">{roomInfo.roomCode}</span>
                        </p>
                    </div>
                    <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${status.bg} ${status.color}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${status.dot}`} />
                        {STATUS_LABELS[status.labelKey] ?? status.fallback}
                    </span>
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                    {roomInfo.timeMode === 'duration' ? (
                        <span className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1">
                            {'ໄລຍະເວລາ'}: {' '}
                            {roomInfo.durationMinutes}
                            {' '}
                            {'ນາທີ'}
                        </span>
                    ) : (
                        <>
                            <span>{'ເລີ່ມຕົ້ນ'}: {formatDateTime(roomInfo.startTime)}</span>
                            <span>{'ສິ້ນສຸດ'}: {formatDateTime(roomInfo.endTime)}</span>
                        </>
                    )}
                </div>

                {user ? (
                    <div className="mt-2 flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2 text-slate-500">
                            <img
                                src={toDisplayAvatarUrl(user.avatar, user.fullName || user.username)}
                                alt={user.fullName || user.username}
                                onError={(event) => onAvatarError(event, user.fullName || user.username)}
                                className="h-7 w-7 rounded-full border border-slate-200 object-cover bg-slate-100"
                            />
                            <span>
                                {'ผู้ใช้'}: <span className="font-medium text-slate-700">{user.fullName}</span>
                            </span>
                        </div>
                        <span className="hidden text-slate-500">
                            {'ຜູ້ໃຊ້'}: <span className="font-medium text-slate-700">{user.fullName}</span>
                        </span>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => router.push('/my-rooms')}
                                className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-700"
                            >
                                {'ອອກຈາກຫ້ອງ'}
                            </button>
                            <button
                                onClick={handleLogout}
                                className="rounded-full border border-rose-200 bg-white px-3 py-1.5 text-rose-600 transition-colors hover:bg-rose-50"
                            >
                                {'ອອກຈາກລະບົບ'}
                            </button>
                        </div>
                    </div>
                ) : null}
            </div>
        </header>
    );
}
