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
    saveVoteRecord: (record: VoteRecord) => void;
    resetRoom: () => void;
}

export const useVoteRoomStore = create<VoteRoomState>((set) => ({
    roomInfo: null,
    candidates: [],
    roomLoading: false,
    roomError: null,
    roomNotFound: false,
    voteRecord: null,

    loadRoom: async (roomCode: string, options?: { silent?: boolean }) => {
        const silent = Boolean(options?.silent);
        if (!silent) {
            set({
                roomLoading: true,
                roomError: null,
                roomNotFound: false,
                candidates: [],
                roomInfo: null,
            });
        }

        try {
            const res = await apiClient.get(`/rooms/code/${roomCode}`);
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
            } else if (user && data.votes) {
                const myVotes = data.votes.filter((v: any) => v.userId === user.id);
                if (myVotes.length > 0) {
                    record = {
                        id: `v${Date.now()}`,
                        userId: user.id,
                        roomId: room.id,
                        selectedIds: myVotes.map((v: any) => v.candidateId),
                        submittedAt: myVotes[0].votedAt,
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
        } catch (err: any) {
            const message = err?.response?.data?.message || err.message || 'Room load failed.';
            const isNotFound = err?.response?.status === 404 || /not found|khong tim thay|bo khong co/i.test(String(message).toLowerCase());
            if (!silent) {
                set({ roomError: message, roomNotFound: isNotFound });
            }
        } finally {
            if (!silent) {
                set({ roomLoading: false });
            }
        }
    },

    saveVoteRecord: (record: VoteRecord) => {
        set({ voteRecord: record });
    },

    resetRoom: () => {
        set({ roomInfo: null, candidates: [], roomError: null, roomNotFound: false, voteRecord: null });
    },
}));
