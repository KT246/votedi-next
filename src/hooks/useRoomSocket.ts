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
} from '../api/socketEvents';

interface UseRoomSocketOptions {
    roomId?: string | null;
    enabled?: boolean;
    onRoomStatusChanged?: (payload: RoomStatusChangedPayload) => void;
    onRoomProgressUpdated?: (payload: RoomProgressUpdatedPayload) => void;
    onRoomResultsReset?: (payload: RoomResultsResetPayload) => void;
}

export function useRoomSocket({
    roomId,
    enabled = true,
    onRoomStatusChanged,
    onRoomProgressUpdated,
    onRoomResultsReset,
}: UseRoomSocketOptions) {
    const onRoomStatusChangedRef = useRef(onRoomStatusChanged);
    const onRoomProgressUpdatedRef = useRef(onRoomProgressUpdated);
    const onRoomResultsResetRef = useRef(onRoomResultsReset);

    useEffect(() => {
        onRoomStatusChangedRef.current = onRoomStatusChanged;
    }, [onRoomStatusChanged]);

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
        const handleRoomProgressUpdated = (payload: RoomProgressUpdatedPayload) => {
            onRoomProgressUpdatedRef.current?.(payload);
        };
        const handleRoomResultsReset = (payload: RoomResultsResetPayload) => {
            onRoomResultsResetRef.current?.(payload);
        };

        socket.on('room:status-changed', handleRoomStatusChanged);
        socket.on('room:progress-updated', handleRoomProgressUpdated);
        socket.on('room:results-reset', handleRoomResultsReset);

        return () => {
            socket.off('room:status-changed', handleRoomStatusChanged);
            socket.off('room:progress-updated', handleRoomProgressUpdated);
            socket.off('room:results-reset', handleRoomResultsReset);
            leaveSocketRoom(normalizedRoomId);
            releaseSocket();
        };
    }, [roomId, enabled]);
}

