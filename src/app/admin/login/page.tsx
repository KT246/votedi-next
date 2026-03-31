"use client";
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAdminAuthStore } from '../../../store/adminAuthStore';
import apiClient from '../../../lib/apiClient';

export default function AdminLoginPage() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const loginAdmin = useAdminAuthStore((state) => state.loginAdmin);
    const router = useRouter();

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();

        if (!username.trim() || !password.trim()) {
            setError('ກະລຸນາປ້ອນຂໍ້ມູນໃຫ້ຄົບຖ້ວນ');
            return;
        }

        setLoading(true);
        setError('');

        try {
            const res = await apiClient.post('/auth/login', {
                username: username.trim(),
                password,
            });

            const { accessToken, access_token, user } = res.data || {};
            const token = accessToken || access_token;
            if (!user || !token) {
                throw new Error('Invalid login response');
            }

            const admin = {
                id: user.id,
                username: user.username,
                fullName: user.fullName,
                role: user.role,
                permissions: user.permissions,
                createdByAdminId: user.createdByAdminId,
            };

            loginAdmin(admin, token);
            router.push('/admin/dashboard');
        } catch (err: unknown) {
            const typedErr = err as { response?: { data?: { message?: string | string[] } }; message?: string };
            const message = typedErr?.response?.data?.message;
            setError(Array.isArray(message) ? message.join(', ') : message || typedErr?.message || 'ຂໍ້ມູນບໍ່ຖືກຕ້ອງ ຫຼື ເຂົ້າລະບົບບໍ່ສຳເລັດ');
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="min-h-screen bg-slate-50 px-4 py-12">
            <div className="mx-auto w-full max-w-sm">
                <div className="mb-8 text-center">
                    <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-indigo-200 bg-indigo-50">
                        <svg className="h-7 w-7 text-indigo-600" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                        </svg>
                    </div>
                    <h1 className="text-2xl font-extrabold text-slate-900">ລະບົບຄຸ້ມຄອງ</h1>
                    <p className="mt-1 text-sm text-slate-500">ເຂົ້າລະບົບສຳລັບຜູ້ດູແລ</p>
                </div>

                <form onSubmit={handleSubmit} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                    <div>
                        <label className="mb-1.5 block text-sm font-semibold text-slate-700">ຊື່ຜູ້ໃຊ້</label>
                        <input
                            type="text"
                            value={username}
                            onChange={(event) => {
                                setUsername(event.target.value);
                                setError('');
                            }}
                            placeholder="admin"
                            autoCapitalize="none"
                            autoCorrect="off"
                            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 focus:border-indigo-300 focus:bg-white focus:outline-none"
                        />
                    </div>

                    <div className="mt-3">
                        <label className="mb-1.5 block text-sm font-semibold text-slate-700">ລະຫັດຜ່ານ</label>
                        <input
                            type="password"
                            value={password}
                            onChange={(event) => {
                                setPassword(event.target.value);
                                setError('');
                            }}
                            placeholder="admin123"
                            autoCapitalize="none"
                            autoCorrect="off"
                            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 focus:border-indigo-300 focus:bg-white focus:outline-none"
                        />
                    </div>

                    {error ? (
                        <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2">
                            <p className="flex items-center gap-2 text-xs text-rose-700">{error}</p>
                        </div>
                    ) : null}

                    <button
                        type="submit"
                        disabled={loading}
                        className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-70"
                    >
                        {loading ? (
                            <>
                                <span className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                                ກຳລັງເຂົ້າລະບົບ...
                            </>
                        ) : (
                            'ເຂົ້າລະບົບ'
                        )}
                    </button>
                </form>
            </div>
        </div>
    );
}
