"use client";
import { ReactNode } from 'react';

interface ErrorStateProps {
    title: string;
    description?: string;
    action?: ReactNode;
}

export default function ErrorState({ title, description, action }: ErrorStateProps) {
    return (
        <div className="rounded-2xl border border-rose-200 bg-[#fcf1f2] px-6 py-10 text-center shadow-[0_10px_30px_-24px_rgba(161,62,72,0.35)]">
            <div className="mx-auto mb-4 h-12 w-12 rounded-xl border border-rose-200 bg-white" />
            <h3 className="text-base font-semibold text-rose-700">{title}</h3>
            {description ? <p className="mt-2 text-sm leading-relaxed text-rose-600">{description}</p> : null}
            {action ? <div className="mt-5">{action}</div> : null}
        </div>
    );
}
