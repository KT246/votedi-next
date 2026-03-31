"use client";
import { create } from 'zustand';
import { User } from '../types';

interface AuthState {
    currentUser: User | null;
    isLoggedIn: boolean;
    isLoading: boolean;
    login: (user: User, token: string) => void;
    logout: () => void;
}

const SESSION_KEY = 'vote_session';
const USER_TOKEN_KEY = 'userAccessToken';

const getInitialState = () => {
    if (typeof window === 'undefined') {
        return { currentUser: null, isLoggedIn: false, isLoading: false };
    }

    const saved = sessionStorage.getItem(SESSION_KEY);
    if (saved) {
        try {
            const { user } = JSON.parse(saved);
            return { currentUser: user, isLoggedIn: !!user, isLoading: false };
        } catch {
            sessionStorage.removeItem(SESSION_KEY);
        }
    }
    return { currentUser: null, isLoggedIn: false, isLoading: false };
};

export const useAuthStore = create<AuthState>((set) => ({
    ...getInitialState(),
    login: (user: User, token: string) => {
        set({ currentUser: user, isLoggedIn: true });
        if (typeof window === 'undefined') return;
        sessionStorage.setItem(SESSION_KEY, JSON.stringify({ user, token }));
        localStorage.setItem(USER_TOKEN_KEY, token);
        // Backward compatibility with old token key.
        localStorage.setItem('accessToken', token);
    },
    logout: () => {
        set({ currentUser: null, isLoggedIn: false });
        if (typeof window === 'undefined') return;
        sessionStorage.removeItem(SESSION_KEY);
        localStorage.removeItem(USER_TOKEN_KEY);
        localStorage.removeItem('accessToken');
    },
}));
