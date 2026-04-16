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
        <div className={`mb-8 flex flex-wrap items-start justify-between gap-4 ${className}`}>
            <div className="min-w-0">
                <h1 className="admin-section-title">{title}</h1>
                {subtitle ? <p className="admin-section-subtitle mt-1">{subtitle}</p> : null}
            </div>
            {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
        </div>
    );
}
