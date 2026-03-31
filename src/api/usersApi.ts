"use client";

import apiClient from './apiClient';

export const usersApi = {
    getAll: () => apiClient.get('/users'),
    getById: (id: string) => apiClient.get(`/users/${id}`),
    create: (data: Record<string, unknown>) => apiClient.post('/users', data),
    importCsv: (rows: Record<string, unknown>[]) => apiClient.post('/users/import', { rows }),
    update: (id: string, data: Record<string, unknown>) => apiClient.patch(`/users/${id}`, data),
    delete: (id: string) => apiClient.delete(`/users/${id}`),
};
