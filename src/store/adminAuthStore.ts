"use client";
import { create } from 'zustand';
import { AdminUser } from '../types';

interface AdminAuthState {
    adminUser: AdminUser | null;
    isAdmin: boolean;
    isAdminLoading: boolean;
    loginAdmin: (admin: AdminUser, token: string) => void;
    setAdminProfile: (admin: AdminUser) => void;
    logoutAdmin: () => void;
}

const ADMIN_SESSION_KEY = 'admin_session';
const ADMIN_TOKEN_KEY = 'adminAccessToken';

function normalizeAdmin(admin: AdminUser): AdminUser {
    return {
        ...admin,
        role: 'admin',
    };
}

const getInitialState = () => {
    if (typeof window === 'undefined') {
        return { adminUser: null, isAdmin: false, isAdminLoading: false };
    }

    const saved = sessionStorage.getItem(ADMIN_SESSION_KEY);
    if (saved) {
        try {
            const { admin } = JSON.parse(saved);
            return { adminUser: admin ? normalizeAdmin(admin) : admin, isAdmin: !!admin, isAdminLoading: false };
        } catch {
            sessionStorage.removeItem(ADMIN_SESSION_KEY);
        }
    }
    return { adminUser: null, isAdmin: false, isAdminLoading: false };
};

export const useAdminAuthStore = create<AdminAuthState>((set) => ({
    ...getInitialState(),
    loginAdmin: (admin: AdminUser, token: string) => {
        const normalizedAdmin = normalizeAdmin(admin);
        set({ adminUser: normalizedAdmin, isAdmin: true });
        if (typeof window === 'undefined') return;
        sessionStorage.setItem(ADMIN_SESSION_KEY, JSON.stringify({ admin: normalizedAdmin, token }));
        localStorage.setItem(ADMIN_TOKEN_KEY, token);
        // Backward compatibility with old token key.
        localStorage.setItem('accessToken', token);
    },
    setAdminProfile: (admin: AdminUser) => {
        const normalizedAdmin = normalizeAdmin(admin);
        set({ adminUser: normalizedAdmin, isAdmin: true });
        if (typeof window === 'undefined') return;
        const saved = sessionStorage.getItem(ADMIN_SESSION_KEY);
        let token = localStorage.getItem(ADMIN_TOKEN_KEY) || localStorage.getItem('accessToken') || '';
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                if (parsed?.token) token = parsed.token;
            } catch {
                // ignore broken session json
            }
        }
        sessionStorage.setItem(ADMIN_SESSION_KEY, JSON.stringify({ admin: normalizedAdmin, token }));
    },
    logoutAdmin: () => {
        set({ adminUser: null, isAdmin: false });
        if (typeof window === 'undefined') return;
        sessionStorage.removeItem(ADMIN_SESSION_KEY);
        localStorage.removeItem(ADMIN_TOKEN_KEY);
        localStorage.removeItem('accessToken');
    },
}));
