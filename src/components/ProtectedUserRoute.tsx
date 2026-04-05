"use client";
import { ReactNode, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuthStore } from '../store/authStore';

export default function ProtectedUserRoute({ children }: { children: ReactNode }) {
    const isLoggedIn = useAuthStore((state) => state.isLoggedIn);
    const pathname = usePathname();
    const router = useRouter();

    useEffect(() => {
        if (!isLoggedIn) {
            const redirectTarget = `${pathname}${window.location.search || ''}`;
            router.replace(`/login?redirect=${encodeURIComponent(redirectTarget)}`);
        }
    }, [isLoggedIn, pathname, router]);

    if (!isLoggedIn) return null;

    return <>{children}</>;
}
