"use client";
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAdminAuthStore } from '../store/adminAuthStore';

export default function AdminRoute({ children }: { children: React.ReactNode }) {
    const isAdmin = useAdminAuthStore(state => state.isAdmin);
    const isAdminLoading = useAdminAuthStore(state => state.isAdminLoading);
    const router = useRouter();

    useEffect(() => {
        if (!isAdminLoading && !isAdmin) {
            router.replace('/admin/login');
        }
    }, [isAdmin, isAdminLoading, router]);

    if (isAdminLoading) return null;
    if (!isAdmin) return null;
    return children;
}