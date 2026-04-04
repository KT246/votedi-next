"use client";
import { create } from 'zustand';
import apiClient from '../api/apiClient';
import { VoteRoom, Candidate, VoteRecord, VoteStatus } from '../types';
import { useAuthStore } from './authStore';

interface VoteRoomState {
    roomInfo: VoteRoom | null;
    candidates: Candidate[];
    roomLoading: boolean;
    roomError: string | null;
    roomNotFound: boolean;
    voteRecord: VoteRecord | null;
    loadRoom: (roomCode: string, options?: { silent?: boolean }) => Promise<void>;
    saveVoteRecord: (record: VoteRecord | null) => void;
    resetRoom: () => void;
}

type LegacyVoteEntry = {
    userId?: unknown;
    candidateId?: unknown;
    votedAt?: unknown;
};

type ApiError = {
    response?: { data?: { message?: unknown }; status?: number };
    message?: string;
};

export const useVoteRoomStore = create<VoteRoomState>((set, get) => ({
    roomInfo: null,
    candidates: [],
    roomLoading: false,
    roomError: null,
    roomNotFound: false,
    voteRecord: null,

    loadRoom: async (roomCode: string, options?: { silent?: boolean }) => {
        const normalizedRoomCode = String(roomCode || '').trim();
        const currentState = get();
        const shouldReuseCurrentRoom =
            !!currentState.roomInfo &&
            String(currentState.roomInfo.roomCode || '').trim() === normalizedRoomCode;
        const silent = Boolean(options?.silent || shouldReuseCurrentRoom);
        if (!silent) {
            set({
                roomLoading: true,
                roomError: null,
                roomNotFound: false,
                candidates: [],
                roomInfo: null,
                voteRecord: null,
            });
        }

        try {
            const res = await apiClient.get(`/rooms/code/${normalizedRoomCode}`);
            const data = res.data;
            if (!data) throw new Error('Room not found');

            const rbRoom = { ...data, status: data.status?.toLowerCase() as VoteStatus || 'draft' };
            const room: VoteRoom = { ...rbRoom, status: rbRoom.status.replace(/[^a-z]/g, '') as VoteStatus };
            const cands = data.candidates || [];

            let record = null;
            const user = useAuthStore.getState().currentUser;
            if (data.myVote && Array.isArray(data.myVote.selectedIds) && data.myVote.selectedIds.length > 0 && user) {
                record = {
                    id: `v${Date.now()}`,
                    userId: user.id,
                    roomId: room.id,
                    selectedIds: data.myVote.selectedIds,
                    submittedAt: data.myVote.votedAt,
                } as VoteRecord;
            } else if (user && Array.isArray(data.votes)) {
                const myVotes = data.votes.filter((vote: unknown) => {
                    const typedVote = vote as LegacyVoteEntry;
                    return String(typedVote.userId || '') === user.id;
                }) as LegacyVoteEntry[];
                if (myVotes.length > 0) {
                    record = {
                        id: `v${Date.now()}`,
                        userId: user.id,
                        roomId: room.id,
                        selectedIds: myVotes
                            .map((vote) => String(vote.candidateId || '').trim())
                            .filter(Boolean),
                        submittedAt: String(myVotes[0].votedAt || ''),
                    } as VoteRecord;
                }
            }

            set({
                roomInfo: room,
                candidates: cands,
                voteRecord: record,
                roomNotFound: false,
                roomError: null,
            });
        } catch (err: unknown) {
            const typedErr = err as ApiError;
            const message =
                (typeof typedErr?.response?.data?.message === 'string' && typedErr.response.data.message) ||
                typedErr?.message ||
                'Room load failed.';
            const isNotFound =
                typedErr?.response?.status === 404 ||
                /not found|khong tim thay|bo khong co/i.test(String(message).toLowerCase());
            if (!silent) {
                set({ roomError: message, roomNotFound: isNotFound });
            }
        } finally {
            if (!silent) {
                set({ roomLoading: false });
            }
        }
    },

    saveVoteRecord: (record: VoteRecord | null) => {
        set({ voteRecord: record });
    },

    resetRoom: () => {
        set({ roomInfo: null, candidates: [], roomError: null, roomNotFound: false, voteRecord: null });
    },
}));
