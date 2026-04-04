"use client";
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAdminAuthStore } from '../store/adminAuthStore';

export default function AdminRoute({ children }: { children: React.ReactNode }) {
    const isAdmin = useAdminAuthStore(state => state.isAdmin);
    const isAdminLoading = useAdminAuthStore(state => state.isAdminLoading);
    const router = useRouter();
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    useEffect(() => {
        if (!mounted) return;
        if (!isAdminLoading && !isAdmin) {
            router.replace('/admin/login');
        }
    }, [isAdmin, isAdminLoading, mounted, router]);

    if (!mounted || isAdminLoading) return null;
    if (!isAdmin) return null;
    return children;
}
