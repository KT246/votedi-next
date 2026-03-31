"use client";
import { useAdminAuthStore } from '../store/adminAuthStore';
import { DEFAULT_OFFICER_PERMISSIONS } from '../types';

export function useAdminRole() {
    const adminUser = useAdminAuthStore((state) => state.adminUser);

    function normalizeId(raw: unknown): string {
        if (!raw) return '';
        if (typeof raw === 'string') return raw.trim();
        if (typeof raw === 'number') return String(raw);
        if (typeof raw === 'object') {
            const candidate = raw as Record<string, unknown> & { toString?: () => string };
            if (typeof candidate.$oid === 'string') return candidate.$oid;
            if (typeof candidate.id === 'string') return candidate.id;
            if (typeof candidate._id === 'string') return candidate._id;
            if (typeof candidate.toString === 'function') {
                const value = candidate.toString();
                if (value && value !== '[object Object]') return value;
            }
        }
        return String(raw);
    }

    const profile = adminUser as { id?: unknown; _id?: unknown } | null;
    const adminId = normalizeId(profile?.id ?? profile?._id);
    const role = adminUser ? 'admin' : '';
    const isAdmin = !!adminUser;
    const isSuperAdmin = false;
    const isOfficer = false;
    const roomFilterAdminId = adminId;

    function canDo(
        action: 'change_status' | 'manage_candidates' | 'manage_users' | 'view_results' | 'export_csv' | 'manage_admins' | 'create_room' | 'delete_room',
    ): boolean {
        if (!isAdmin) return false;
        if (action === 'manage_admins') return false;
        return true;
    }

    function isOwner(ownerAdminId?: string) {
        return normalizeId(ownerAdminId) === adminId;
    }

    return {
        role,
        adminId,
        isSuperAdmin,
        isAdmin,
        isOfficer,
        officerPerms: DEFAULT_OFFICER_PERMISSIONS,
        roomFilterAdminId,
        canDo,
        isOwner,
    };
}
