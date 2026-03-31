"use client";
import { useEffect, useRef } from 'react';
import {
    acquireSocket,
    joinSocketRoom,
    leaveSocketRoom,
    releaseSocket,
} from '../api/socketClient';
import type {
    RoomProgressUpdatedPayload,
    RoomResultsResetPayload,
    RoomStatusChangedPayload,
    VoteNewPayload,
} from '../api/socketEvents';

interface UseRoomSocketOptions {
    roomId?: string | null;
    enabled?: boolean;
    onRoomStatusChanged?: (payload: RoomStatusChangedPayload) => void;
    onVoteNew?: (payload: VoteNewPayload) => void;
    onRoomProgressUpdated?: (payload: RoomProgressUpdatedPayload) => void;
    onRoomResultsReset?: (payload: RoomResultsResetPayload) => void;
}

export function useRoomSocket({
    roomId,
    enabled = true,
    onRoomStatusChanged,
    onVoteNew,
    onRoomProgressUpdated,
    onRoomResultsReset,
}: UseRoomSocketOptions) {
    const onRoomStatusChangedRef = useRef(onRoomStatusChanged);
    const onVoteNewRef = useRef(onVoteNew);
    const onRoomProgressUpdatedRef = useRef(onRoomProgressUpdated);
    const onRoomResultsResetRef = useRef(onRoomResultsReset);

    useEffect(() => {
        onRoomStatusChangedRef.current = onRoomStatusChanged;
    }, [onRoomStatusChanged]);

    useEffect(() => {
        onVoteNewRef.current = onVoteNew;
    }, [onVoteNew]);

    useEffect(() => {
        onRoomProgressUpdatedRef.current = onRoomProgressUpdated;
    }, [onRoomProgressUpdated]);

    useEffect(() => {
        onRoomResultsResetRef.current = onRoomResultsReset;
    }, [onRoomResultsReset]);

    useEffect(() => {
        const normalizedRoomId = String(roomId || '').trim();
        if (!enabled || !normalizedRoomId) return;

        const socket = acquireSocket();
        if (!socket) return;
        joinSocketRoom(normalizedRoomId);

        const handleRoomStatusChanged = (payload: RoomStatusChangedPayload) => {
            onRoomStatusChangedRef.current?.(payload);
        };
        const handleVoteNew = (payload: VoteNewPayload) => {
            onVoteNewRef.current?.(payload);
        };
        const handleRoomProgressUpdated = (payload: RoomProgressUpdatedPayload) => {
            onRoomProgressUpdatedRef.current?.(payload);
        };
        const handleRoomResultsReset = (payload: RoomResultsResetPayload) => {
            onRoomResultsResetRef.current?.(payload);
        };

        socket.on('room:status-changed', handleRoomStatusChanged);
        socket.on('vote:new', handleVoteNew);
        socket.on('room:progress-updated', handleRoomProgressUpdated);
        socket.on('room:results-reset', handleRoomResultsReset);

        return () => {
            socket.off('room:status-changed', handleRoomStatusChanged);
            socket.off('vote:new', handleVoteNew);
            socket.off('room:progress-updated', handleRoomProgressUpdated);
            socket.off('room:results-reset', handleRoomResultsReset);
            leaveSocketRoom(normalizedRoomId);
            releaseSocket();
        };
    }, [roomId, enabled]);
}

