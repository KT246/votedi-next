"use client";

interface ToastMessageProps {
    message: string;
}

export default function ToastMessage({ message }: ToastMessageProps) {
    if (!message) return null;

    return (
        <div
            role="status"
            aria-live="polite"
            className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-2xl bg-gray-900 px-5 py-3 text-sm text-white shadow-xl"
        >
            {message}
        </div>
    );
}
