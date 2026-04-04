"use client";

type ParticipationTone = "success" | "warning" | "neutral";

interface ParticipationStatusCardProps {
  title: string;
  description: string;
  statusLabel: string;
  tone?: ParticipationTone;
  detailLines?: string[];
}

const TONE_STYLES: Record<ParticipationTone, string> = {
  success: "border-emerald-200 bg-emerald-50 text-emerald-700",
  warning: "border-amber-200 bg-amber-50 text-amber-700",
  neutral: "border-slate-200 bg-slate-50 text-slate-700",
};

export default function ParticipationStatusCard({
  title,
  description,
  statusLabel,
  tone = "neutral",
  detailLines = [],
}: ParticipationStatusCardProps) {
  return (
    <div className="px-4 py-4">
      <div className={`rounded-3xl border p-6 shadow-sm ${TONE_STYLES[tone]}`}>
        <h2 className="text-xl font-bold text-slate-900">{title}</h2>
        <p className="mt-2 text-sm text-slate-600">{description}</p>

        <div className="mt-4 inline-flex items-center rounded-full border border-current/20 px-4 py-1.5 text-sm font-semibold">
          {statusLabel}
        </div>

        {detailLines.length > 0 ? (
          <div className="mt-4 space-y-1 text-left">
            {detailLines.map((line) => (
              <p key={line} className="text-sm text-slate-600">
                {line}
              </p>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
