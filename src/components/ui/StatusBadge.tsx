"use client";
import { ReactNode } from 'react';

type StatusTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info';

interface StatusBadgeProps {
    label: string;
    tone?: StatusTone;
    icon?: ReactNode;
}

const TONE_CLASS: Record<StatusTone, string> = {
    neutral: 'border-slate-200 bg-slate-100 text-slate-700',
    success: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    warning: 'border-amber-200 bg-amber-50 text-amber-700',
    danger: 'border-rose-200 bg-rose-50 text-rose-700',
    info: 'border-indigo-200 bg-indigo-50 text-indigo-700',
};

export default function StatusBadge({ label, tone = 'neutral', icon }: StatusBadgeProps) {
    return (
        <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${TONE_CLASS[tone]}`}
        >
            {icon ? <span className="inline-flex h-3.5 w-3.5 items-center justify-center">{icon}</span> : null}
            <span>{label}</span>
        </span>
    );
}
