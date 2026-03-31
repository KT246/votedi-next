"use client";
import { useVoteRoomStore } from '../store/voteRoomStore';
import { onAvatarError, toDisplayAvatarUrl } from '../utils/avatar';
import ModalShell from './ui/ModalShell';
interface VoteConfirmModalProps {
    selectedIds: string[];
    onCancel: () => void;
    onConfirm: () => void;
    submitting: boolean;
    submitError?: string;
}

export default function VoteConfirmModal({
    selectedIds,
    onCancel,
    onConfirm,
    submitting,
    submitError,
}: VoteConfirmModalProps) {
        const candidates = useVoteRoomStore((state) => state.candidates);
    const selected = candidates.filter((candidate) => selectedIds.includes(candidate.id));

    const footer = (
        <div className="flex gap-3">
            <button
                type="button"
                onClick={onCancel}
                disabled={submitting}
                className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-60"
            >
                {'ຍົກເລີກ'}
            </button>
            <button
                type="button"
                onClick={onConfirm}
                disabled={submitting}
                className="flex-1 rounded-xl bg-indigo-600 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-indigo-700 disabled:opacity-70"
            >
                {submitting ? 'ກຳລັງສົ່ງ...' : 'ຢືນຢັນສົ່ງຄະແນນ'}
            </button>
        </div>
    );

    return (
        <ModalShell
            open
            title={'ຢືນຢັນການໂຫວດ'}
            description={'ກະລຸນາກວດສອບຜູ້ທີ່ເລືອກກ່ອນສົ່ງຄະແນນ'}
            onClose={onCancel}
            maxWidthClass="max-w-sm"
            footer={footer}
        >
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="mb-2 text-xs font-semibold text-slate-700">{'ຜູ້ທີ່ເລືອກ'}:</p>
                <div className="space-y-2">
                    {selected.map((candidate) => (
                        <div key={candidate.id} className="flex items-center gap-3">
                            <img
                                src={toDisplayAvatarUrl(candidate.avatar, candidate.name)}
                                alt={candidate.name}
                                onError={(event) => onAvatarError(event, candidate.name)}
                                className="h-8 w-8 rounded-lg bg-white object-cover"
                            />
                            <div className="min-w-0">
                                <p className="truncate text-sm font-semibold text-slate-900">{candidate.name}</p>
                                <p className="truncate text-xs text-slate-500">{candidate.title}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {submitError ? <p className="mt-4 text-xs text-rose-600">{submitError}</p> : null}
        </ModalShell>
    );
}
