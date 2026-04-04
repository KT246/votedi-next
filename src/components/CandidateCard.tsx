"use client";
import { useState } from 'react';
import { Candidate } from '../types';
import { onAvatarError, toDisplayAvatarUrl } from '../utils/avatar';
import { cleanCandidateText, formatLaoDate } from '../utils/candidateDisplay';

interface CandidateCardProps {
    candidate: Candidate;
    selected: boolean;
    onToggle: (id: string) => void;
    onPreview?: (candidate: Candidate) => void;
    disabled: boolean;
    maxSelection: number;
    currentSelectionCount: number;
}

export default function CandidateCard({
    candidate,
    selected,
    onToggle,
    onPreview,
    disabled,
    maxSelection,
    currentSelectionCount,
}: CandidateCardProps) {
        const [expanded, setExpanded] = useState(false);

    const canSelect = !disabled && (selected || currentSelectionCount < maxSelection);

    function handleToggle() {
        if (!canSelect) return;
        onToggle(candidate.id);
    }

    return (
        <div
            className={`overflow-hidden rounded-2xl border bg-white transition-colors ${
                selected
                    ? 'border-indigo-500 shadow-sm'
                    : 'border-slate-200 hover:border-slate-300'
            } ${disabled && !selected ? 'opacity-60' : ''}`}
        >
            <div
                role="button"
                tabIndex={canSelect ? 0 : -1}
                onClick={handleToggle}
                onKeyDown={(event) => {
                    if (!canSelect) return;
                    if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        handleToggle();
                    }
                }}
                className="flex w-full items-start gap-3 p-4 text-left"
                aria-disabled={!canSelect}
            >
                <button
                    type="button"
                    onClick={(event) => {
                        event.stopPropagation();
                        onPreview?.(candidate);
                    }}
                    className="relative shrink-0 cursor-zoom-in overflow-hidden rounded-xl border border-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300"
                    aria-label={`ເບິ່ງຮູບຂອງ ${candidate.name}`}
                >
                    <img
                        src={toDisplayAvatarUrl(candidate.avatar, candidate.name)}
                        alt={candidate.name}
                        onError={(event) => onAvatarError(event, candidate.name)}
                        className="h-14 w-14 bg-slate-100 object-cover"
                    />
                    <span className="absolute bottom-0 right-0 bg-slate-900/70 px-1.5 py-0.5 text-[10px] font-medium text-white">
                        {'ເບິ່ງຮູບ'}
                    </span>
                </button>

                <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-bold leading-snug text-slate-900">{candidate.name}</h3>
                    {candidate.date ? (
                        <p className="mt-0.5 text-xs font-medium text-indigo-600">
                            {`ວັນເດືອນປີເກີດ: ${formatLaoDate(candidate.date)}`}
                        </p>
                    ) : null}
                    {candidate.title ? (
                        <p className="mt-0.5 text-xs text-slate-500">{`ຕຳແໜ່ງ: ${cleanCandidateText(candidate.title) || candidate.title}`}</p>
                    ) : null}
                </div>

                <span
                    className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 ${
                        selected
                            ? 'border-indigo-600 bg-indigo-600 text-white'
                            : canSelect
                                ? 'border-slate-300'
                                : 'border-slate-200'
                    }`}
                >
                    {selected ? (
                        <svg className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                    ) : null}
                </span>
            </div>

            <div className="border-t border-slate-100 px-4 py-3">
                <button
                    onClick={() => setExpanded((prev) => !prev)}
                    className="text-xs font-medium text-indigo-600 transition-colors hover:text-indigo-700"
                >
                    {expanded ? 'ສະແດງນ້ອຍລົງ' : 'ສະແດງລາຍລະອຽດເພີ່ມ'}
                </button>

                {expanded ? (
                    <div className="mt-3 space-y-2">
                        {cleanCandidateText(candidate.fullProfile) ? (
                            <p className="text-xs leading-relaxed text-slate-600">{cleanCandidateText(candidate.fullProfile)}</p>
                        ) : null}
                        {candidate.achievements && candidate.achievements.length > 0 ? (
                            <div>
                                <p className="mb-1 text-xs font-semibold text-slate-700">
                                    {'ຜົນສຳເລັດ'}:
                                </p>
                                <ul className="space-y-1">
                                    {candidate.achievements.map((achievement, index) => (
                                        <li key={index} className="text-xs text-slate-500">
                                            - {achievement}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        ) : null}
                    </div>
                ) : null}
            </div>
        </div>
    );
}
