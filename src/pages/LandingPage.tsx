"use client";
import Link from 'next/link';
import { useAuthStore } from '../store/authStore';

export default function LandingPage() {
        const user = useAuthStore((state) => state.currentUser);
    const isLoggedIn = useAuthStore((state) => state.isLoggedIn);

    return (
        <div className="min-h-screen bg-slate-50 px-4 py-12">
            <div className="mx-auto w-full max-w-3xl">
                <div className="text-center">
                    <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-indigo-200 bg-indigo-50">
                        <svg className="h-7 w-7 text-indigo-600" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m0 0l3-3m-3 3l-3-3M5 12a7 7 0 1114 0 7 7 0 01-14 0z" />
                        </svg>
                    </div>
                    <h1 className="text-4xl font-black tracking-tight text-slate-900">{'ເວັບໂຫວດ'}</h1>
                    <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-slate-500">{'ລະບົບການເລືອກຕັ້ງອອນໄລນ໌. ສະແກນ QR ເພື່ອເຂົ້າຮ່ວມຫ້ອງເລືອກຕັ້ງ ຫຼື ລອງໃຊ້ງານຕົວຢ່າງດ້ານລຸ່ມ.'}</p>
                </div>

                {isLoggedIn && user ? (
                    <div className="mx-auto mt-6 max-w-md rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600 shadow-sm">
                        {'ສະບາຍດີ'}: <span className="font-semibold text-slate-900">{user.fullName}</span>
                    </div>
                ) : null}

                <div className="mx-auto mt-8 max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                    <h2 className="text-base font-bold text-slate-900">{'ຫ້ອງເລືອກຕັ້ງຕົວຢ່າງ (DEMO)'}</h2>
                    <p className="mt-2 text-sm leading-relaxed text-slate-500">{'ຫຼື ສະແກນ QR code ເພື່ອເຂົ້າຫ້ອງໂດຍກົງ'}</p>
                </div>

                <div className="mx-auto mt-8 w-full max-w-md">
                    <Link
                        href={isLoggedIn ? '/my-rooms' : '/login'}
                        className="flex w-full items-center justify-center rounded-xl bg-indigo-600 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-indigo-700"
                    >
                        {isLoggedIn ? 'ໄປຫ້ອງຂອງຂ້ອຍ' : 'ເຂົ້າລະບົບ'}
                    </Link>
                </div>
            </div>
        </div>
    );
}
