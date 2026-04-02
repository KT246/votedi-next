"use client";

import { useEffect, useState } from "react";

interface RoomCountdownBannerProps {
  endTime?: string | null;
  startTime?: string | null;
  durationMinutes?: number | null;
}

function formatCountdown(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const parts: string[] = [];
  if (hours > 0) parts.push(`${hours} ຊົ່ວໂມງ`);
  if (minutes > 0 || hours > 0) parts.push(`${minutes} ນາທີ`);
  parts.push(`${seconds} ວິນາທີ`);

  return parts.join(" ");
}

function resolveCountdownTargetMs({
  endTime,
  startTime,
  durationMinutes,
}: RoomCountdownBannerProps): number | null {
  if (endTime) {
    const parsed = Date.parse(endTime);
    return Number.isNaN(parsed) ? null : parsed;
  }

  if (startTime && durationMinutes) {
    const parsedStart = Date.parse(startTime);
    if (!Number.isNaN(parsedStart)) {
      return parsedStart + durationMinutes * 60 * 1000;
    }
  }

  return null;
}

export default function RoomCountdownBanner({
  endTime,
  startTime,
  durationMinutes,
}: RoomCountdownBannerProps) {
  const targetMs = resolveCountdownTargetMs({
    endTime,
    startTime,
    durationMinutes,
  });
  const [nowTs, setNowTs] = useState(() => Date.now());

  useEffect(() => {
    if (targetMs === null) return;

    const timer = window.setInterval(() => {
      setNowTs(Date.now());
    }, 1000);

    return () => window.clearInterval(timer);
  }, [targetMs]);

  if (targetMs === null) return null;

  const remainingMs = Math.max(0, targetMs - nowTs);

  return (
    <div className="mb-4 rounded-2xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-center text-sm font-semibold text-indigo-700">
      {"ນັບຖອຍຫຼັງ:"} {formatCountdown(remainingMs)}
    </div>
  );
}
