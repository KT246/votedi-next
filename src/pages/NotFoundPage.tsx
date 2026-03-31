"use client";
import { useRouter } from 'next/navigation';
export default function NotFoundPage() {
    const router = useRouter();

    return (
        <div className="min-h-screen bg-slate-50 px-4">
            <div className="mx-auto flex min-h-screen max-w-lg items-center justify-center">
                <div className="w-full rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
                    <div className="mx-auto mb-4 h-12 w-12 rounded-xl border border-slate-200 bg-slate-50" />
                    <h1 className="text-xl font-bold text-slate-900">{'ບໍ່ພົບໜ້າ'}</h1>
                    <p className="mt-2 text-sm leading-relaxed text-slate-500">
                        {'ບໍ່ພົບໜ້ານີ້ ຫຼື ຖືກລຶບອອກຈາກລະບົບແລ້ວ'}
                    </p>
                    <button
                        onClick={() => router.push('/')}
                        className="mt-5 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-indigo-700"
                    >
                        {'ກັບໄປໜ້າຫຼັກ'}
                    </button>
                </div>
            </div>
        </div>
    );
}

