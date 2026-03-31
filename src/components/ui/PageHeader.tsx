"use client";
import { ReactNode } from 'react';

interface PageHeaderProps {
    title: ReactNode;
    subtitle?: ReactNode;
    actions?: ReactNode;
    className?: string;
}

export default function PageHeader({ title, subtitle, actions, className = '' }: PageHeaderProps) {
    return (
        <div className={`mb-6 flex flex-wrap items-start justify-between gap-3 ${className}`}>
            <div className="min-w-0">
                <h1 className="text-xl font-extrabold text-gray-900">{title}</h1>
                {subtitle ? <p className="mt-0.5 text-xs text-gray-400">{subtitle}</p> : null}
            </div>
            {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
        </div>
    );
}
