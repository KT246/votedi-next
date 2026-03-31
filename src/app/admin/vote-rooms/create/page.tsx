"use client";

import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';

import AdminRoute from '../../../../components/AdminRoute';
import ErrorState from '../../../../components/ui/ErrorState';
import { roomsApi } from '../../../../api/roomsApi';

export default function AdminVoteRoomCreateRoute() {
    const router = useRouter();
    const [roomName, setRoomName] = useState('');
    const [description, setDescription] = useState('');
    const [maxSelection, setMaxSelection] = useState(1);
    const [durationMinutes, setDurationMinutes] = useState(60);
    const [allowResultView, setAllowResultView] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setSubmitting(true);
        setError('');
        try {
            const payload = {
                roomName: roomName.trim(),
                description: description.trim(),
                voteType: 'multi' as const,
                maxSelection: Number.isFinite(maxSelection) && maxSelection > 0 ? maxSelection : 1,
                timeMode: 'duration' as const,
                durationMinutes: Number.isFinite(durationMinutes) && durationMinutes > 0 ? durationMinutes : 60,
                allowResultView,
                status: 'draft' as const,
            };
            const res = await roomsApi.create(payload);
            const roomId = String(res.data?.id || res.data?._id || '');
            router.push(roomId ? `/admin/vote-rooms/${roomId}` : '/admin/vote-rooms');
        } catch (err: unknown) {
            const typedErr = err as { response?: { data?: { message?: string | string[] } }; message?: string };
            const message = typedErr?.response?.data?.message;
            setError(Array.isArray(message) ? message.join(', ') : message || typedErr?.message || 'ບໍ່ສາມາດສ້າງຫ້ອງໄດ້');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <AdminRoute>
            <div className="min-h-screen bg-slate-50 p-6">
                <div className="mx-auto max-w-3xl">
                    <div className="mb-6 flex items-center justify-between gap-3">
                        <div>
                            <h1 className="text-2xl font-bold text-slate-900">ສ້າງຫ້ອງໃໝ່</h1>
                            <p className="text-slate-500">ສ້າງຫ້ອງ vote ແບບຮ່າງກ່ອນໄດ້.</p>
                        </div>
                        <Link
                            href="/admin/vote-rooms"
                            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
                        >
                            ກັບຄືນ
                        </Link>
                    </div>

                    {error ? (
                        <div className="mb-4">
                            <ErrorState
                                title="ສ້າງຫ້ອງບໍ່ສຳເລັດ"
                                description={error}
                                action={
                                    <button
                                        onClick={() => setError('')}
                                        className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
                                    >
                                        ປິດ
                                    </button>
                                }
                            />
                        </div>
                    ) : null}

                    <form onSubmit={handleSubmit} className="space-y-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                        <div>
                            <label className="mb-2 block text-sm font-medium text-slate-700">ຊື່ຫ້ອງ</label>
                            <input
                                value={roomName}
                                onChange={(event) => setRoomName(event.target.value)}
                                required
                                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 focus:border-indigo-300 focus:bg-white focus:outline-none"
                                placeholder="ຕົວຢ່າງ: ການເລືອກຕັ້ງປີ 2026"
                            />
                        </div>

                        <div>
                            <label className="mb-2 block text-sm font-medium text-slate-700">ຄຳອະທິບາຍ</label>
                            <textarea
                                value={description}
                                onChange={(event) => setDescription(event.target.value)}
                                rows={4}
                                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 focus:border-indigo-300 focus:bg-white focus:outline-none"
                                placeholder="ອະທິບາຍສັ້ນໆເກື່ອນກັບຫ້ອງນີ້"
                            />
                        </div>

                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                            <div>
                                <label className="mb-2 block text-sm font-medium text-slate-700">ຈຳນວນເລືອກສູງສຸດ</label>
                                <input
                                    type="number"
                                    min={1}
                                    value={maxSelection}
                                    onChange={(event) => setMaxSelection(Number(event.target.value) || 1)}
                                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 focus:border-indigo-300 focus:bg-white focus:outline-none"
                                />
                            </div>
                            <div>
                                <label className="mb-2 block text-sm font-medium text-slate-700">ໄລຍະເວລາ (ນາທີ)</label>
                                <input
                                    type="number"
                                    min={1}
                                    value={durationMinutes}
                                    onChange={(event) => setDurationMinutes(Number(event.target.value) || 60)}
                                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 focus:border-indigo-300 focus:bg-white focus:outline-none"
                                    placeholder="60"
                                />
                                <p className="mt-2 text-xs text-slate-500">ຫ້ອງຈະເປີດໃຊ້ງານຕາມຈຳນວນນາທີນີ້</p>
                            </div>
                            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
                                <p className="text-sm font-medium text-slate-700">ຮູບແບບການໂຫວດ</p>
                                <p className="mt-1 text-sm text-slate-500">ເລືອກຫຼາຍຄົນ</p>
                            </div>
                        </div>

                        <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
                            <input
                                type="checkbox"
                                checked={allowResultView}
                                onChange={(event) => setAllowResultView(event.target.checked)}
                                className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                            />
                            <span className="text-sm text-slate-700">ອະນຸຍາດໃຫ້ເບິ່ງຜົນໄດ້ເມື່ອຫ້ອງປິດ</span>
                        </label>

                        <div className="flex flex-wrap items-center justify-end gap-3">
                            <Link
                                href="/admin/vote-rooms"
                                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
                            >
                                ຍົກເລີກ
                            </Link>
                            <button
                                type="submit"
                                disabled={submitting}
                                className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                {submitting ? 'ກຳລັງສ້າງ...' : 'ສ້າງຫ້ອງ'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </AdminRoute>
    );
}
