"use client";
import { useState } from 'react';
import apiClient from '../api/apiClient';
import { useAuthStore } from '../store/authStore';
import ModalShell from './ui/ModalShell';

interface ForceChangePasswordModalProps {
    required?: boolean;
    onClose?: () => void;
}

export default function ForceChangePasswordModal({ required = true, onClose }: ForceChangePasswordModalProps) {
        const user = useAuthStore((state) => state.currentUser);
    const login = useAuthStore((state) => state.login);
    const logout = useAuthStore((state) => state.logout);

    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');

    const accountName = user?.username ? `"${user.username}"` : 'ບັນຊີນີ້';
    const description = required
        ? 'ບັນຊີນີ້ຖືກສ້າງໂດຍ admin. ກະລຸນາປ່ຽນລະຫັດຜ່ານກ່ອນໃຊ້ງານ'
        : 'ເພື່ອຄວາມປອດໄພ ກະລຸນາປ່ຽນລະຫັດຜ່ານ';

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError('');

        if (!currentPassword.trim() || !newPassword.trim()) {
            setError('ກະລຸນາປ້ອນຂໍ້ມູນລະຫັດຜ່ານໃຫ້ຄົບ');
            return;
        }

        if (newPassword.length < 6) {
            setError('ລະຫັດຜ່ານໃໝ່ຕ້ອງຢ່າງນ້ອຍ 6 ຕົວອັກສອນ');
            return;
        }

        if (newPassword !== confirmPassword) {
            setError('ລະຫັດຜ່ານບໍ່ກົງກັນ');
            return;
        }

        setSubmitting(true);
        try {
            const res = await apiClient.post('/auth/user/change-password', {
                currentPassword,
                newPassword,
            });
            const { user: updatedUser, accessToken } = res.data || {};
            if (!updatedUser || !accessToken) throw new Error('Invalid change password response');

            login(updatedUser, accessToken);
            setCurrentPassword('');
            setNewPassword('');
            setConfirmPassword('');
            setError('');
            if (!required) onClose?.();
        } catch (err: any) {
            const message = err?.response?.data?.message;
            setError(Array.isArray(message) ? message.join(', ') : message || 'ປ່ຽນລະຫັດຜ່ານບໍ່ສຳເລັດ');
        } finally {
            setSubmitting(false);
        }
    }

    const footer = (
        <div className="flex gap-2">
            {required ? (
                <button
                    type="button"
                    onClick={logout}
                    className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50"
                >
                    {'ອອກຈາກລະບົບ'}
                </button>
            ) : (
                <button
                    type="button"
                    onClick={() => onClose?.()}
                    className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50"
                >
                    {'ຍົກເລີກ'}
                </button>
            )}
            <button
                type="submit"
                form="force-change-password-form"
                disabled={submitting}
                className="flex-1 rounded-xl bg-indigo-600 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-70"
            >
                {submitting ? 'ກຳລັງສົ່ງ...' : 'ບັນທຶກ'}
            </button>
        </div>
    );

    return (
        <ModalShell
            open
            title={required ? 'ປ່ຽນລະຫັດຜ່ານຄັ້ງທຳອິດ' : 'ປ່ຽນລະຫັດຜ່ານ'}
            description={description}
            onClose={() => {
                if (!required) onClose?.();
            }}
            maxWidthClass="max-w-md"
            closeOnBackdrop={!required}
            showCloseButton={!required}
            footer={footer}
        >
            <form id="force-change-password-form" onSubmit={handleSubmit} className="space-y-3">
                <input
                    type="password"
                    value={currentPassword}
                    onChange={(event) => setCurrentPassword(event.target.value)}
                    placeholder={'ລະຫັດຜ່ານປັດຈຸບັນ'}
                    autoComplete="current-password"
                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200"
                />
                <input
                    type="password"
                    value={newPassword}
                    onChange={(event) => setNewPassword(event.target.value)}
                    placeholder={'ລະຫັດຜ່ານໃໝ່'}
                    autoComplete="new-password"
                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200"
                />
                <input
                    type="password"
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    placeholder={'ຢືນຢັນລະຫັດຜ່ານໃໝ່'}
                    autoComplete="new-password"
                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200"
                />

                {error ? <p className="text-xs text-rose-600">{error}</p> : null}
            </form>
        </ModalShell>
    );
}
