"use client";
import { ReactNode } from 'react';

interface EmptyStateProps {
    title: string;
    description?: string;
    action?: ReactNode;
}

export default function EmptyState({ title, description, action }: EmptyStateProps) {
    return (
        <div className="rounded-2xl border border-slate-200 bg-white px-6 py-10 text-center shadow-sm">
            <div className="mx-auto mb-4 h-12 w-12 rounded-xl border border-slate-200 bg-slate-50" />
            <h3 className="text-base font-semibold text-slate-900">{title}</h3>
            {description ? <p className="mt-2 text-sm leading-relaxed text-slate-500">{description}</p> : null}
            {action ? <div className="mt-5">{action}</div> : null}
        </div>
    );
}
