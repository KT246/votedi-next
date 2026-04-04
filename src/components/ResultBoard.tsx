"use client";
import { useVoteRoomStore } from "../store/voteRoomStore";
import { Candidate, VoteResult } from "../types";
import { onAvatarError, toDisplayAvatarUrl } from "../utils/avatar";

interface ResultBoardProps {
  results: VoteResult[];
  onPreview?: (candidate: Candidate) => void;
}

export default function ResultBoard({
  results,
  onPreview,
}: ResultBoardProps) {
  const candidates = useVoteRoomStore((state) => state.candidates);

  const resultMap = new Map(results.map((item) => [item.candidateId, item.voteCount]));
  const orderedCandidateIds = new Set<string>();
  const mergedResults = candidates.map((candidate) => {
    orderedCandidateIds.add(candidate.id);
    return {
      candidate,
      voteCount: resultMap.get(candidate.id) || 0,
    };
  });

  for (const result of results) {
    if (orderedCandidateIds.has(result.candidateId)) continue;
    mergedResults.push({
      candidate: {
        id: result.candidateId,
        name: "ຜູ້ສະໝັກບໍ່ຮູ້ຈັກ",
        avatar: "",
        title: "",
        shortBio: "",
        fullProfile: "",
      },
      voteCount: result.voteCount,
    });
  }

  const sorted = mergedResults.sort((a, b) => b.voteCount - a.voteCount);
  const totalVotes = sorted.reduce((sum, result) => sum + result.voteCount, 0);

  return (
    <div className="px-4 pb-8">
      <div className="mb-5 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
        <h2 className="text-lg font-bold text-slate-900">{"ຜົນການໂຫວດ"}</h2>
        <p className="mt-1 text-sm text-slate-500">
          {"ຄະແນນລວມ"}: <span className="font-bold text-slate-700">{totalVotes}</span>
        </p>
      </div>

      <div className="space-y-3">
        {sorted.map((row, index) => {
          const percentage = totalVotes > 0 ? Math.round((row.voteCount / totalVotes) * 100) : 0;

          return (
            <div key={row.candidate.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="mb-3 flex items-center gap-3">
                <span
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                    index === 0
                      ? "bg-amber-400 text-amber-900"
                      : index === 1
                        ? "bg-slate-300 text-slate-700"
                        : index === 2
                          ? "bg-orange-500 text-white"
                          : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {index + 1}
                </span>

                <button
                  type="button"
                  onClick={() => onPreview?.(row.candidate)}
                  className="cursor-zoom-in rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300"
                  aria-label={`ເບິ່ງຮູບຂອງ ${row.candidate.name}`}
                >
                  <img
                    src={toDisplayAvatarUrl(row.candidate.avatar, row.candidate.name)}
                    alt={row.candidate.name}
                    onError={(event) => onAvatarError(event, row.candidate.name)}
                    className="h-10 w-10 rounded-xl bg-slate-100 object-cover"
                  />
                </button>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-slate-900">
                    {row.candidate.name}
                  </p>
                  <p className="text-xs text-slate-500">{row.candidate.title || "-"}</p>
                </div>

                <div className="shrink-0 text-right">
                  <p className="text-lg font-extrabold text-indigo-600">{percentage}%</p>
                  <p className="text-xs text-slate-400">
                    {row.voteCount} {"ຄະແນນ"}
                  </p>
                </div>
              </div>

              <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                <div
                  className={`h-full rounded-full ${
                    index === 0 ? "bg-indigo-500" : index === 1 ? "bg-indigo-300" : "bg-slate-300"
                  }`}
                  style={{ width: `${percentage}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
