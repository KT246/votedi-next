"use client";

import { ReactNode, useEffect } from "react";
import { X } from "lucide-react";

interface ModalShellProps {
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  maxWidthClass?: string;
  closeOnBackdrop?: boolean;
  showCloseButton?: boolean;
  closeAriaLabel?: string;
}

export default function ModalShell({
  open,
  title,
  description,
  onClose,
  children,
  footer,
  maxWidthClass = "max-w-md",
  closeOnBackdrop = true,
  showCloseButton = true,
  closeAriaLabel,
}: ModalShellProps) {
  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-[#122419]/45 backdrop-blur-[2px]"
        onClick={closeOnBackdrop ? onClose : undefined}
      />
      <div
        className={`relative w-full ${maxWidthClass} overflow-hidden rounded-2xl border border-[var(--admin-border)] bg-white shadow-[0_28px_80px_-40px_rgba(18,36,25,0.45)]`}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-[var(--admin-border)] bg-[var(--admin-surface-muted)] px-5 py-4">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-slate-900">
              {title}
            </p>
            {description ? (
              <p className="mt-1 text-xs leading-relaxed text-slate-500">
                {description}
              </p>
            ) : null}
          </div>
          {showCloseButton ? (
            <button
              type="button"
              onClick={onClose}
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[var(--admin-border)] text-slate-500 transition-colors hover:bg-white hover:text-slate-700"
              aria-label={closeAriaLabel || "Close dialog"}
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}
        </div>
        <div className="px-5 py-5">{children}</div>
        {footer ? (
          <div className="border-t border-[var(--admin-border)] bg-[var(--admin-surface-muted)] px-5 py-4">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}
