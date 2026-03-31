"use client";
import { type SyntheticEvent, useEffect, useState } from 'react';
import ModalShell from './ui/ModalShell';
import { onAvatarError } from '../utils/avatar';

interface ImagePreviewModalProps {
    open: boolean;
    imageUrl: string;
    title: string;
    subtitle?: string;
    onClose: () => void;
}

function toInitials(text: string) {
    const cleaned = String(text || '').trim();
    if (!cleaned) return 'NA';
    const parts = cleaned.split(/\s+/).slice(0, 2);
    return parts.map((part) => part[0]?.toUpperCase() || '').join('') || 'NA';
}

export default function ImagePreviewModal({ open, imageUrl, title, subtitle, onClose }: ImagePreviewModalProps) {
        const [loadError, setLoadError] = useState(false);

    useEffect(() => {
        if (!open) return;
        setLoadError(false);
    }, [open, imageUrl]);

    function handleImageError(event: SyntheticEvent<HTMLImageElement>) {
        const img = event.currentTarget;
        const attemptedFallback = img.dataset.fallbackAttempted === '1';
        if (!attemptedFallback) {
            img.dataset.fallbackAttempted = '1';
            onAvatarError(event, title);
            return;
        }
        setLoadError(true);
    }

    return (
        <ModalShell
            open={open}
            title={title}
            description={subtitle}
            onClose={onClose}
            maxWidthClass="max-w-3xl"
        >
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <div className="flex min-h-[52vh] max-h-[72vh] items-center justify-center overflow-hidden rounded-lg bg-white p-3">
                    {loadError ? (
                        <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-slate-50 px-6 py-8 text-center">
                            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-100 text-lg font-bold text-indigo-700">
                                {toInitials(title)}
                            </div>
                            <p className="text-sm font-semibold text-slate-800">
                                {'ບໍ່ສາມາດໂຫຼດຮູບນີ້ໄດ້'}
                            </p>
                            <p className="mt-1 text-xs leading-relaxed text-slate-500">
                                {'ລິ້ງຮູບອາດບໍ່ຖືກຕ້ອງ ຫຼື ບໍ່ອະນຸຍາດໃຫ້ເຂົ້າເບິ່ງ'}
                            </p>
                            {imageUrl ? (
                                <a
                                    href={imageUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="mt-4 inline-flex rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-100"
                                >
                                    {'ເປີດຮູບໃນແຖບໃໝ່'}
                                </a>
                            ) : null}
                        </div>
                    ) : (
                        <img
                            src={imageUrl}
                            alt={title}
                            onError={handleImageError}
                            className="max-h-[68vh] max-w-full object-contain"
                        />
                    )}
                </div>
            </div>
        </ModalShell>
    );
}
