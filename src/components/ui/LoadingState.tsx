"use client";

interface LoadingStateProps {
    label?: string;
}

export default function LoadingState({ label = 'ກຳລັງໂຫຼດ...' }: LoadingStateProps) {
    return (
        <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 px-4 text-center">
            <span className="h-10 w-10 rounded-full border-4 border-[var(--admin-accent)] border-t-transparent animate-spin" />
            <p className="text-sm text-[var(--admin-text-muted)]">{label}</p>
        </div>
    );
}
