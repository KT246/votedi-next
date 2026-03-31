"use client";
import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuthStore } from '../store/authStore';
import apiClient from '../api/apiClient';

const localTranslations: Record<string, string> = {
    error_device_active_with_attempts: 'ບັນຊີນີ້ກຳລັງໃຊ້ຢູ່ອຸປະກອນອື່ນ. ຍັງເຫຼືອ {{count}} ຄັ້ງກ່ອນຖືກລັອກຊົ່ວຄາວ',
    error_device_active: 'ບັນຊີນີ້ກຳລັງໃຊ້ຢູ່ອຸປະກອນອື່ນ. ກະລຸນາອອກຈາກລະບົບທີ່ນັ້ນກ່ອນ',
    error_temporarily_locked_seconds: 'ບັນຊີຖືກລັອກຊົ່ວຄາວ. ລອງໃໝ່ຫຼັງຈາກ {{seconds}} ວິນາທີ',
    error_temporarily_locked: 'ບັນຊີຖືກລັອກຊົ່ວຄາວເນື່ອງຈາກພະຍາຍາມເຂົ້າລະບົບຫຼາຍເກີນໄປ',
    error_login_failed: 'ເຂົ້າລະບົບບໍ່ສຳເລັດ. ກະລຸນາລອງໃໝ່.',
};

export default function LoginPage() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const login = useAuthStore((state) => state.login);
    const router = useRouter();
    const searchParams = useSearchParams();

    function sanitizeRedirectTarget(rawRedirect: string | null): string {
        const fallback = '/my-rooms';
        if (!rawRedirect) return fallback;

        const target = String(rawRedirect).trim();
        if (!target.startsWith('/')) return fallback;
        if (target.startsWith('//')) return fallback;
        if (target.startsWith('/admin')) return fallback;

        return target;
    }

    const redirect = sanitizeRedirectTarget(searchParams?.get('redirect') ?? null);

    function toApiErrorMessage(err: unknown): string {
        const typedErr = err as { response?: { data?: { message?: string | string[] } }; message?: string };
        const message = typedErr?.response?.data?.message;
        if (Array.isArray(message)) return message.join(', ');
        return message || typedErr?.message || 'ເຂົ້າລະບົບບໍ່ສຳເລັດ. ກະລຸນາລອງໃໝ່.';
    }

    function normalizeLoginError(message: string): string {
        const raw = String(message || '');
        const lower = raw.toLowerCase();
        const resolveText = (key: string, fallback: string, options?: Record<string, unknown>) => {
            let text = localTranslations[key] ?? fallback;
            if (options) {
                for (const [k, v] of Object.entries(options)) {
                    text = text.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), String(v));
                }
            }
            return text;
        };

        if (lower.includes('already active on another device')) {
            const remaining = raw.match(/(\d+)\s*attempt\(s\)\s*left/i)?.[1];
            if (remaining) {
                return resolveText(
                    'error_device_active_with_attempts',
                    `Account is active on another device. ${remaining} attempts left before temporary lock.`,
                    { count: remaining },
                );
            }
            return resolveText('error_device_active', 'Account is active on another device. Please logout there first.');
        }

        if (lower.includes('temporarily locked') || lower.includes('too many login attempts')) {
            const seconds = raw.match(/(\d+)\s*seconds?/i)?.[1];
            if (seconds) {
                return resolveText(
                    'error_temporarily_locked_seconds',
                    `Account is temporarily locked. Try again after ${seconds} seconds.`,
                    { seconds },
                );
            }
            return resolveText('error_temporarily_locked', 'Account is temporarily locked due to too many login attempts.');
        }

        return raw;
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();

        if (!username.trim() || !password.trim()) {
            setError('ກະລຸນາປ້ອນຊື່ຜູ້ໃຊ້.');
            return;
        }

        setLoading(true);
        setError('');
        try {
            const res = await apiClient.post('/auth/user/login', {
                username: username.trim(),
                password,
            });
            const { user, accessToken } = res.data;
            if (!user || !accessToken) throw new Error('Invalid login response');
            login(user, accessToken);
            router.replace(redirect);
        } catch (err: unknown) {
            const message = toApiErrorMessage(err);
            setError(normalizeLoginError(message));
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
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 11c1.657 0 3-1.343 3-3S13.657 5 12 5s-3 1.343-3 3 1.343 3 3 3zm0 0c-3.314 0-6 2.239-6 5v1h12v-1c0-2.761-2.686-5-6-5z" />
                        </svg>
                    </div>
                    <h1 className="text-2xl font-extrabold text-slate-900">{'ເວັບໂຫວດ'}</h1>
                    <p className="mt-1 text-sm text-slate-500">{'ເຂົ້າລະບົບເພື່ອເຂົ້າຮ່ວມການເລືອກຕັ້ງ'}</p>
                </div>

                <form onSubmit={handleSubmit} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                    <div>
                        <label className="mb-1.5 block text-sm font-semibold text-slate-700">{'ຊື່ຜູ້ໃຊ້ (username)'}</label>
                        <input
                            type="text"
                            value={username}
                            onChange={(event) => {
                                setUsername(event.target.value);
                                setError('');
                            }}
                            placeholder={'ຕົວຢ່າງ: somxay.sivilay'}
                            autoCapitalize="none"
                            autoCorrect="off"
                            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 focus:border-indigo-300 focus:bg-white focus:outline-none"
                        />
                    </div>

                    <div className="mt-3">
                        <label className="mb-1.5 block text-sm font-semibold text-slate-700">{'ລະຫັດຜ່ານ'}</label>
                        <input
                            type="password"
                            value={password}
                            onChange={(event) => {
                                setPassword(event.target.value);
                                setError('');
                            }}
                            placeholder={'ປ້ອນລະຫັດຜ່ານ'}
                            autoCapitalize="none"
                            autoCorrect="off"
                            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 focus:border-indigo-300 focus:bg-white focus:outline-none"
                        />
                    </div>

                    {error ? (
                        <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2">
                            <p className="text-xs font-semibold text-rose-700">{'ເຂົ້າລະບົບບໍ່ສຳເລັດ'}</p>
                            <p className="mt-1 text-xs text-rose-600">{error}</p>
                        </div>
                    ) : null}

                    <button
                        type="submit"
                        disabled={loading}
                        className="mt-5 flex w-full items-center justify-center rounded-xl bg-indigo-600 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-70"
                    >
                        {loading ? 'ກຳລັງເຂົ້າລະບົບ...' : 'ເຂົ້າລະບົບ'}
                    </button>
                </form>
            </div>
        </div>
    );
}

