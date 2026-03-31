"use client";
import { ReactNode, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuthStore } from '../store/authStore';
import ForceChangePasswordModal from './ForceChangePasswordModal';

export default function ProtectedUserRoute({ children }: { children: ReactNode }) {
    const isLoggedIn = useAuthStore((state) => state.isLoggedIn);
    const currentUser = useAuthStore((state) => state.currentUser);
    const pathname = usePathname();
    const router = useRouter();

    useEffect(() => {
        if (!isLoggedIn) {
            const redirectTarget = `${pathname}${window.location.search || ''}`;
            router.replace(`/login?redirect=${encodeURIComponent(redirectTarget)}`);
        }
    }, [isLoggedIn, pathname, router]);

    if (!isLoggedIn) return null;

    return (
        <>
            {children}
            {currentUser?.mustChangePassword ? <ForceChangePasswordModal /> : null}
        </>
    );
}
