"use client";

interface LoadingStateProps {
    label?: string;
}

export default function LoadingState({ label = 'Loading...' }: LoadingStateProps) {
    return (
        <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 px-4 text-center">
            <span className="h-10 w-10 rounded-full border-4 border-indigo-500 border-t-transparent animate-spin" />
            <p className="text-sm text-slate-500">{label}</p>
        </div>
    );
}
