"use client";
import apiClient from './apiClient';
import { VoteRoom } from '../types';

// Room CRUD operations
export const roomsApi = {
    getAll: () => apiClient.get('/rooms'),

    getById: (id: string) => apiClient.get(`/rooms/${id}`),

    getByCode: (code: string) => apiClient.get(`/rooms/code/${code}`),

    getMyRooms: () => apiClient.get('/rooms/my-rooms'),

    create: (data: Partial<VoteRoom>) => apiClient.post('/rooms', data),

    update: (id: string, data: Partial<VoteRoom>) => apiClient.patch(`/rooms/${id}`, data),

    updateStatus: (id: string, status: string) => apiClient.patch(`/rooms/${id}`, { status }),

    delete: (id: string) => apiClient.delete(`/rooms/${id}`),

    // User management (allowed voters)
    addUser: (roomId: string, username: string, fullName: string) =>
        apiClient.post(`/rooms/${roomId}/users`, { username, fullName }),

    removeUser: (roomId: string, userId: string) =>
        apiClient.delete(`/rooms/${roomId}/users/${userId}`),

    // Results
    getResults: (roomId: string) => apiClient.get(`/rooms/${roomId}/results`),
};
