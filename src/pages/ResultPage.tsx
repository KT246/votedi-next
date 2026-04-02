"use client";
import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useVoteRoomStore } from '../store/voteRoomStore';
import apiClient from '../api/apiClient';
import { Candidate, VoteResult } from '../types';
import RoomHeader from '../components/RoomHeader';
import ResultBoard from '../components/ResultBoard';
import ImagePreviewModal from '../components/ImagePreviewModal';
import NotFoundPage from './NotFoundPage';
import { toDisplayAvatarUrl } from '../utils/avatar';
import LoadingState from '../components/ui/LoadingState';
import EmptyState from '../components/ui/EmptyState';
import ErrorState from '../components/ui/ErrorState';
import { useRoomSocket } from '../hooks/useRoomSocket';

function normalizeId(raw: unknown): string {
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

function normalizeStatus(raw: unknown): string {
    return String(raw || '').trim().toLowerCase().replace(/[^a-z]/g, '');
}

export default function ResultPage() {
    const params = useParams<{ roomCode?: string }>() || {};
    const roomCode = String(params.roomCode || '').trim();
    const { roomInfo, roomLoading, roomNotFound, loadRoom } = useVoteRoomStore();
    const roomKey = normalizeId(roomInfo?.id || roomInfo?.roomCode);
    const roomStatus = normalizeStatus(roomInfo?.status);

    const [results, setResults] = useState<VoteResult[]>([]);
    const [resultsLoading, setResultsLoading] = useState(false);
    const [resultsError, setResultsError] = useState('');
    const [previewCandidate, setPreviewCandidate] = useState<Candidate | null>(null);

    useEffect(() => {
        if (roomCode) {
            void loadRoom(roomCode);
        }
    }, [roomCode, loadRoom]);

    const fetchResults = useCallback(async (targetRoomId: string) => {
        const roomId = String(targetRoomId || '').trim();
        if (!roomId) {
            return;
        }

        setResultsLoading(true);
        setResultsError('');
        try {
            const res = await apiClient.get(`/rooms/${roomId}/results`);
            const mapped = (res.data || []).map((item: unknown) => {
                const typedItem = item as { candidateId?: string; voteCount?: number };
                return {
                    candidateId: typedItem.candidateId,
                    voteCount: typedItem.voteCount,
                };
            });
            setResults(mapped);
        } catch (error: unknown) {
            const typedError = error as { response?: { data?: { message?: string | string[] } }; message?: string };
            const message = typedError?.response?.data?.message;
            const errorMessage = Array.isArray(message)
                ? message.join(', ')
                : message || typedError?.message || 'ບໍ່ສາມາດໂຫຼດຂໍ້ມູນຜົນການ. ກະລຸນາລອງອີກຄັ້ງ';
            setResultsError(errorMessage);
            setResults([]);
        } finally {
            setResultsLoading(false);
        }
    }, []);

    useEffect(() => {
        if (roomStatus !== 'closed' || !roomKey) {
            setResults([]);
            setResultsLoading(false);
            setResultsError('');
            return;
        }

        void fetchResults(roomKey);
    }, [roomKey, roomStatus, fetchResults]);

    useRoomSocket({
        roomId: roomInfo?.id,
        enabled: !!roomInfo?.id && !!roomCode,
        onRoomStatusChanged: (payload) => {
            const payloadRoomId = normalizeId(payload.roomId);
            if (!roomCode || payloadRoomId !== normalizeId(roomInfo?.id)) return;

            const nextStatus = normalizeStatus(payload.status);
            if (nextStatus && nextStatus === roomStatus) {
                return;
            }

            void loadRoom(roomCode, { silent: true });
            if (nextStatus === 'closed') {
                void fetchResults(payloadRoomId);
            }

            if (
                nextStatus === 'draft' ||
                nextStatus === 'pending' ||
                nextStatus === 'open'
            ) {
                setResults([]);
                setResultsError('');
            }
        },
        onRoomResultsReset: (payload) => {
            if (normalizeId(payload.roomId) !== normalizeId(roomInfo?.id)) return;
            setResults([]);
            setResultsError('');
        },
    });

    if (roomNotFound || (!roomLoading && !roomInfo)) {
        return <NotFoundPage />;
    }

    if (roomLoading || resultsLoading) {
        return <LoadingState label={'ກຳລັງໂຫຼດຜົນ...'} />;
    }

    if (roomInfo?.status === 'closed' && resultsError) {
        return (
            <div className="min-h-screen bg-slate-50">
                <RoomHeader />
                <div className="mx-auto max-w-lg px-4 py-6">
                    <ErrorState
                        title={'ບໍ່ສາມາດໂຫຼດຜົນໄດ້'}
                        description={resultsError}
                        action={(
                            <button
                                onClick={() => {
                                    if (roomKey) {
                                        void fetchResults(roomKey);
                                    }
                                }}
                                className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-indigo-700"
                            >
                                {'ລອງອີກຄັ້ງ'}
                            </button>
                        )}
                    />
                </div>
            </div>
        );
    }

    if (roomInfo && roomInfo.status !== 'closed') {
        return (
            <div className="min-h-screen bg-slate-50">
                <RoomHeader />
                <div className="flex min-h-[60vh] items-center justify-center px-4">
                    <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
                        <h2 className="text-lg font-bold text-slate-900">{'ຫ້ອງຍັງບໍ່ປິດ'}</h2>
                        <p className="mt-2 text-sm text-slate-500">
                            {'ຜົນຈະສະແດງເມື່ອຫ້ອງຖືກປິດ'}
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50">
            <RoomHeader />
            <div className="mx-auto max-w-lg py-6">
                {results.length === 0 ? (
                    <EmptyState
                        title={'ຍັງບໍ່ມີຜົນ'}
                        description={'ຫ້ອງນີ້ຍັງບໍ່ມີຂໍ້ມູນຄະແນນ'}
                    />
                ) : (
                    <ResultBoard results={results} onPreview={setPreviewCandidate} />
                )}
            </div>

            <ImagePreviewModal
                open={!!previewCandidate}
                imageUrl={toDisplayAvatarUrl(previewCandidate?.avatar, previewCandidate?.name || 'ຜູ້ສະໝັກບໍ່ຮູ້ຈັກ')}
                title={previewCandidate?.name || 'ຜູ້ສະໝັກບໍ່ຮູ້ຈັກ'}
                subtitle={previewCandidate?.title}
                onClose={() => setPreviewCandidate(null)}
            />
        </div>
    );
}
