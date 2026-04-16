"use client";
import { ReactNode } from 'react';

interface EmptyStateProps {
    title: string;
    description?: string;
    action?: ReactNode;
}

export default function EmptyState({ title, description, action }: EmptyStateProps) {
    return (
        <div className="admin-card px-6 py-10 text-center">
            <div className="mx-auto mb-4 h-12 w-12 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-accent-soft)]/70" />
            <h3 className="text-base font-semibold text-slate-900">{title}</h3>
            {description ? <p className="mt-2 text-sm leading-relaxed text-slate-500">{description}</p> : null}
            {action ? <div className="mt-5">{action}</div> : null}
        </div>
    );
}
