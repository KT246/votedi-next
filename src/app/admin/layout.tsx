"use client";

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';

import { useAdminAuthStore } from '../../store/adminAuthStore';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
    const adminUser = useAdminAuthStore((state) => state.adminUser);
    const logoutAdmin = useAdminAuthStore((state) => state.logoutAdmin);
    const router = useRouter();
    const pathname = usePathname();
    const currentPath = pathname ?? '';
    const [mounted, setMounted] = useState(false);

    const navItems = [
        { href: '/admin/dashboard', label: 'ໜ້າຫຼັກ' },
        { href: '/admin/users', label: 'ຈັດການຜູ້ໃຊ້' },
        { href: '/admin/vote-rooms', label: 'ຈັດການຫ້ອງ' },
    ];

    useEffect(() => {
        if (currentPath !== '/admin/login' && !adminUser) {
            router.replace('/admin/login');
        }
    }, [adminUser, currentPath, router]);

    useEffect(() => {
        setMounted(true);
    }, []);

    const handleLogout = () => {
        logoutAdmin();
        router.push('/admin/login');
    };

    if (currentPath === '/admin/login') {
        return <>{children}</>;
    }

    return (
        <div className="min-h-screen flex flex-col">
            <nav className="bg-white border-b border-slate-200">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between h-16">
                        <div className="flex">
                            <div className="flex-shrink-0 flex items-center">
                                <span className="text-xl font-bold text-indigo-600">ລະບົບລົງຄະແນນ</span>
                            </div>
                            <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
                                {navItems.map((item) => {
                                    const isActive = currentPath === item.href || currentPath.startsWith(`${item.href}/`);
                                    return (
                                        <Link
                                            key={item.href}
                                            href={item.href}
                                            className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium ${
                                                isActive
                                                    ? 'border-indigo-500 text-slate-900'
                                                    : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700'
                                            }`}
                                        >
                                            {item.label}
                                        </Link>
                                    );
                                })}
                            </div>
                        </div>
                        <div className="hidden sm:ml-6 sm:flex sm:items-center">
                            {mounted && adminUser && (
                                <div className="flex items-center space-x-4">
                                    <span className="text-sm text-slate-700">
                                        {adminUser.fullName} (ຜູ້ດູແລ)
                                    </span>
                                    <Link
                                        href="/admin/change-password"
                                        className="text-sm text-slate-500 hover:text-slate-700"
                                    >
                                        ປ່ຽນລະຫັດຜ່ານ
                                    </Link>
                                    <button
                                        onClick={handleLogout}
                                        className="text-sm text-slate-500 hover:text-slate-700"
                                    >
                                        ອອກຈາກລະບົບ
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </nav>
            <main className="flex-1">{children}</main>
        </div>
    );
}
