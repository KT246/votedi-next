"use client";
import { create } from 'zustand';

interface AlertDialogState {
    open: boolean;
    title: string;
    message: string;
}

interface ConfirmDialogState {
    open: boolean;
    title: string;
    message: string;
    onResolve?: (confirmed: boolean) => void;
}

interface DialogState {
    alert: AlertDialogState;
    confirm: ConfirmDialogState;
    openAlert: (message: string, title?: string) => void;
    closeAlert: () => void;
    openConfirm: (message: string, title?: string) => Promise<boolean>;
    resolveConfirm: (confirmed: boolean) => void;
}

export const useDialogStore = create<DialogState>((set, get) => ({
    alert: {
        open: false,
        title: '',
        message: '',
    },
    confirm: {
        open: false,
        title: '',
        message: '',
    },
    openAlert: (message: string, title = 'Notification') => {
        set({
            alert: {
                open: true,
                title,
                message,
            },
        });
    },
    closeAlert: () => {
        set({
            alert: {
                open: false,
                title: '',
                message: '',
            },
        });
    },
    openConfirm: (message: string, title = 'Confirm') => {
        return new Promise<boolean>((resolve) => {
            set({
                confirm: {
                    open: true,
                    title,
                    message,
                    onResolve: resolve,
                },
            });
        });
    },
    resolveConfirm: (confirmed: boolean) => {
        const resolver = get().confirm.onResolve;
        if (resolver) {
            resolver(confirmed);
        }
        set({
            confirm: {
                open: false,
                title: '',
                message: '',
                onResolve: undefined,
            },
        });
    },
}));

export function showAlertDialog(message: string, title?: string) {
    useDialogStore.getState().openAlert(message, title);
}

export function showConfirmDialog(message: string, title?: string) {
    return useDialogStore.getState().openConfirm(message, title);
}
