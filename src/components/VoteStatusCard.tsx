"use client";
import { VoteRecord } from '../types';

interface VoteStatusCardProps {
    voteRecord: VoteRecord | null;
    allowResultView: boolean;
    onViewResult?: () => void;
}

export default function VoteStatusCard({
    voteRecord,
    allowResultView,
    onViewResult,
}: VoteStatusCardProps) {
    const submittedTime = voteRecord?.submittedAt
        ? new Date(voteRecord.submittedAt).toLocaleString('lo-LA', { dateStyle: 'short', timeStyle: 'short' })
        : null;

    return (
        <div className="px-4 py-4">
            <div className="rounded-3xl border border-emerald-100 bg-white p-6 text-center shadow-sm">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-emerald-200 bg-emerald-50">
                    <svg className="h-8 w-8 text-emerald-600" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                </div>

                <h2 className="mb-2 text-xl font-bold text-slate-900">{'ສົ່ງຄະແນນສຳເລັດ'}</h2>
                <p className="mb-1 text-sm text-slate-500">{'ຄະແນນຂອງທ່ານຖືກບັນທຶກແລ້ວ'}</p>
                {submittedTime ? <p className="mb-4 text-xs text-slate-400">{'ເວລາທີ່ສົ່ງ'}: {submittedTime}</p> : null}

                <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-1.5 text-sm font-semibold text-emerald-700">
                    <span className="h-2 w-2 rounded-full bg-emerald-500" />
                    {'ສະຖານະ: ສຳເລັດ'}
                </div>

                {allowResultView ? (
                    <button
                        onClick={onViewResult}
                        className="mt-6 w-full max-w-xs rounded-xl bg-indigo-600 py-3 text-sm font-semibold text-white transition-colors hover:bg-indigo-700"
                    >
                        {'ເບິ່ງຜົນການເລືອກຕັ້ງ'}
                    </button>
                ) : (
                    <div className="mt-6 w-full max-w-xs rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
                        <p className="text-sm font-semibold text-amber-700">{'ຍັງບໍ່ສາມາດເບິ່ງຜົນໄດ້'}</p>
                        <p className="mt-1 text-xs text-amber-600">{'ກະລຸນາລໍຖ້າໃຫ້ຫ້ອງປິດກ່ອນເພື່ອເບິ່ງຜົນ'}</p>
                    </div>
                )}
            </div>
        </div>
    );
}
