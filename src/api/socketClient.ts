"use client";
import { io, Socket } from 'socket.io-client';

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL?.trim() || '';

let socket: Socket | null = null;
let activeConsumers = 0;
const joinedRoomRefs = new Map<string, number>();

export const isSocketEnabled = Boolean(SOCKET_URL);

export const getSocket = (): Socket | null => {
    if (!isSocketEnabled) return null;
    if (!socket) {
        socket = io(SOCKET_URL, {
            autoConnect: false,
        });
    }
    return socket;
};

export const acquireSocket = (): Socket | null => {
    const nextSocket = getSocket();
    if (!nextSocket) {
        return null;
    }
    activeConsumers += 1;
    if (!nextSocket.connected) {
        nextSocket.connect();
    }
    return nextSocket;
};

export const releaseSocket = (): void => {
    if (!isSocketEnabled) return;
    activeConsumers = Math.max(0, activeConsumers - 1);
    if (activeConsumers === 0 && socket?.connected) {
        socket.disconnect();
        joinedRoomRefs.clear();
    }
};

export const joinSocketRoom = (roomId: string): void => {
    if (!isSocketEnabled) return;
    if (!roomId) return;
    const nextSocket = getSocket();
    if (!nextSocket) return;
    const currentRef = joinedRoomRefs.get(roomId) || 0;
    joinedRoomRefs.set(roomId, currentRef + 1);
    if (currentRef === 0) {
        nextSocket.emit('joinRoom', roomId);
    }
};

export const leaveSocketRoom = (roomId: string): void => {
    if (!isSocketEnabled) return;
    if (!roomId) return;
    const nextSocket = getSocket();
    if (!nextSocket) return;
    const currentRef = joinedRoomRefs.get(roomId) || 0;
    if (currentRef <= 1) {
        joinedRoomRefs.delete(roomId);
        nextSocket.emit('leaveRoom', roomId);
        return;
    }
    joinedRoomRefs.set(roomId, currentRef - 1);
};
