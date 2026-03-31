"use client";

import { useRouter } from 'next/navigation';
import { useAuthStore } from '../store/authStore';
import { useVoteRoomStore } from '../store/voteRoomStore';
import { VoteStatus } from '../types';

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
    const roomInfo = useVoteRoomStore((state) => state.roomInfo);
    const router = useRouter();

    const status = roomInfo ? STATUS_CONFIG[roomInfo.status] || STATUS_CONFIG.closed : STATUS_CONFIG.closed;

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
                        <span className="text-slate-500">
                            {'ຜູ້ໃຊ້'}: <span className="font-medium text-slate-700">{user.fullName}</span>
                        </span>
                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => router.push('/my-rooms')}
                                className="text-slate-500 transition-colors hover:text-slate-700"
                            >
                                {'ອອກຈາກຫ້ອງ'}
                            </button>
                        </div>
                    </div>
                ) : null}
            </div>
        </header>
    );
}
