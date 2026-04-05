"use client";
import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import RoomHeader from "../components/RoomHeader";
import CandidateCard from "../components/CandidateCard";
import VoteConfirmModal from "../components/VoteConfirmModal";
import VoteStatusCard from "../components/VoteStatusCard";
import ImagePreviewModal from "../components/ImagePreviewModal";
import { useAuthStore } from "../store/authStore";
import { useVoteRoomStore } from "../store/voteRoomStore";
import apiClient from "../api/apiClient";
import { showAlertDialog } from "../store/dialogStore";
import { Candidate } from "../types";
import { toDisplayAvatarUrl } from "../utils/avatar";
import LoadingState from "../components/ui/LoadingState";
import ErrorState from "../components/ui/ErrorState";
import EmptyState from "../components/ui/EmptyState";
import StatusBadge from "../components/ui/StatusBadge";
import { useRoomSocket } from "../hooks/useRoomSocket";
import RoomCountdownBanner from "../components/RoomCountdownBanner";

function normalizeId(raw: unknown): string {
  if (!raw) return "";
  if (typeof raw === "string") return raw.trim();
  if (typeof raw === "number") return String(raw);
  if (typeof raw === "object") {
    const maybe = raw as {
      $oid?: unknown;
      id?: unknown;
      _id?: unknown;
      toString?: () => string;
    };
    if (typeof maybe.$oid === "string") return maybe.$oid;
    if (typeof maybe.id === "string") return maybe.id;
    if (typeof maybe._id === "string") return maybe._id;
    if (typeof maybe.toString === "function") {
      const value = maybe.toString();
      if (value && value !== "[object Object]") return value;
    }
  }
  return String(raw);
}

function resolveCountdownTargetMs(roomInfo: {
  endTime?: string | null;
  startTime?: string | null;
  durationMinutes?: number | null;
} | null): number | null {
  if (!roomInfo) return null;
  if (roomInfo.endTime) {
    const parsed = Date.parse(roomInfo.endTime);
    return Number.isNaN(parsed) ? null : parsed;
  }

  if (roomInfo.startTime && roomInfo.durationMinutes) {
    const parsedStart = Date.parse(roomInfo.startTime);
    if (!Number.isNaN(parsedStart)) {
      return parsedStart + roomInfo.durationMinutes * 60 * 1000;
    }
  }

  return null;
}

function RoomStatePanel({
  title,
  description,
  actionLabel,
  onAction,
}: {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
        <h2 className="text-lg font-bold text-slate-900">{title}</h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-500">
          {description}
        </p>
        {actionLabel && onAction ? (
          <button
            onClick={onAction}
            className="mt-5 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-indigo-700"
          >
            {actionLabel}
          </button>
        ) : null}
      </div>
    </div>
  );
}

export default function VoteRoomPage() {
  const params = useParams<{ roomCode?: string }>() || {};
  const roomCode = params.roomCode;
  const router = useRouter();
  const user = useAuthStore((state) => state.currentUser);
  const {
    roomInfo,
    candidates,
    roomLoading,
    roomError,
    roomNotFound,
    voteRecord,
    loadRoom,
    saveVoteRecord,
  } = useVoteRoomStore();

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [previewCandidate, setPreviewCandidate] = useState<Candidate | null>(
    null,
  );
  const [checkedInRoomCode, setCheckedInRoomCode] = useState("");
  const [checkInError, setCheckInError] = useState("");

  function toApiErrorMessage(err: unknown) {
    const typedErr = err as {
      response?: { data?: { message?: string | string[]; status?: number } };
      message?: string;
    };
    const message = typedErr?.response?.data?.message;
    if (Array.isArray(message)) return message.join(", ");
    return message || typedErr?.message || "ສົ່ງບັດບໍ່ສຳເລັດ. ກະລຸນາລອງໃໝ່.";
  }

  async function submitVoteRequest() {
    if (!roomInfo || !user) {
      throw new Error("ຂໍ້ມູນຫ້ອງ ຫຼື ຜູ້ໃຊ້ບໍ່ຄົບ");
    }

    // Ensure voter is checked into room before submitting vote.
    // This is idempotent and prevents backend rejection on stricter check-in policies.
    await apiClient.post("/auth/user/room-login", {
      roomCode: roomInfo.roomCode,
    });

    await apiClient.post(`/rooms/${roomInfo.id}/vote`, {
      userId: user.id,
      selectedCandidateIds: selectedIds,
    });
  }

  useEffect(() => {
    if (roomCode) loadRoom(roomCode);
  }, [roomCode, loadRoom]);

  useEffect(() => {
    setCheckedInRoomCode("");
    setCheckInError("");
  }, [roomCode]);

  useRoomSocket({
    roomId: roomInfo?.id,
    enabled: !!roomInfo?.id && !!roomCode,
    onRoomStatusChanged: (data) => {
      if (!roomCode || normalizeId(data.roomId) !== normalizeId(roomInfo?.id))
        return;
      void loadRoom(roomCode);
    },
    onVoteNew: (data) => {
      if (!roomCode || normalizeId(data.roomId) !== normalizeId(roomInfo?.id)) {
        return;
      }
      void loadRoom(roomCode, { silent: true });
    },
    onRoomProgressUpdated: (data) => {
      if (!roomCode || normalizeId(data.roomId) !== normalizeId(roomInfo?.id)) {
        return;
      }
      void loadRoom(roomCode, { silent: true });
    },
  });

  useEffect(() => {
    const currentRoomCode = roomInfo?.roomCode;
    const currentRoomStatus = roomInfo?.status;

    if (!currentRoomCode || !user) return;
    if (currentRoomStatus !== "open" && currentRoomStatus !== "pending") return;
    if (checkedInRoomCode === currentRoomCode) return;

    let active = true;

    void (async () => {
      setCheckInError("");
      try {
        await apiClient.post("/auth/user/room-login", {
          roomCode: currentRoomCode,
        });
        if (active) {
          setCheckedInRoomCode(currentRoomCode);
        }
      } catch (err: unknown) {
        if (!active) return;
        const message = toApiErrorMessage(err);
        const statusCode = Number(
          (err as { response?: { status?: number } })?.response?.status || 0,
        );

        if (statusCode === 401 || statusCode === 403) {
          showAlertDialog(
            "ບັນຊີນີ້ບໍ່ມີສິດເຂົ້າໃຊ້ຫ້ອງນີ້",
            "ບໍ່ອະນຸຍາດເຂົ້າຫ້ອງ",
          );
          router.push("/my-rooms");
          return;
        }

        setCheckInError(message);
      }
    })();

    return () => {
      active = false;
    };
  }, [roomInfo?.roomCode, roomInfo?.status, user, checkedInRoomCode, router]);

  useEffect(() => {
    if (roomInfo?.status === "closed" && roomCode) {
      router.push(`/vote-room/${roomCode}/result`);
    }
  }, [roomInfo?.status, roomCode, router]);

  const countdownTargetMs = resolveCountdownTargetMs(roomInfo);

  useEffect(() => {
    if (!roomCode || roomInfo?.status !== "open" || countdownTargetMs === null) {
      return;
    }

    const remainingMs = countdownTargetMs - Date.now();
    if (remainingMs <= 0) {
      void loadRoom(roomCode);
      return;
    }

    const refreshTimer = window.setTimeout(() => {
      void loadRoom(roomCode);
    }, remainingMs + 250);

    return () => window.clearTimeout(refreshTimer);
  }, [countdownTargetMs, loadRoom, roomCode, roomInfo?.status]);

  useEffect(() => {
    if (!roomCode || roomInfo?.status !== "open") return;

    const refreshTimer = window.setInterval(() => {
      if (document.hidden) return;
      void loadRoom(roomCode, { silent: true });
    }, 60000);

    return () => window.clearInterval(refreshTimer);
  }, [loadRoom, roomCode, roomInfo?.status]);

  useEffect(() => {
    if (!roomCode || roomLoading || !roomNotFound) return;
    showAlertDialog(
      "ຫ້ອງນີ້ບໍ່ມີຢູ່ ຫຼື ຖືກລົບແລ້ວ. ລະບົບຈະພາທ່ານກັບໄປລາຍການຫ້ອງ.",
      "ບໍ່ພົບຫ້ອງເລືອກຕັ້ງ",
    );
    router.push("/my-rooms");
  }, [roomCode, roomLoading, roomNotFound, router]);

  function toggleCandidate(id: string) {
    if (roomInfo?.maxSelection === 1) {
      setSelectedIds((prev) => (prev[0] === id ? [] : [id]));
      return;
    }

    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  }

  async function handleConfirmVote() {
    setSubmitting(true);
    setSubmitError("");

    try {
      await submitVoteRequest();
    } catch (err: unknown) {
      const message = toApiErrorMessage(err);
      setSubmitError(message);
      showAlertDialog(message, "ສົ່ງຄະແນນບໍ່ສຳເລັດ");
      setSubmitting(false);
      return;
    }

    try {
      saveVoteRecord({
        userId: user!.id,
        roomId: roomInfo!.id,
        selectedIds,
        submittedAt: new Date().toISOString(),
      });
      setShowConfirm(false);
      setSubmitError("");
    } catch {
      const message = "ສົ່ງບັດບໍ່ສຳເລັດ. ກະລຸນາລອງໃໝ່.";
      setSubmitError(message);
      showAlertDialog(message, "ສົ່ງຄະແນນບໍ່ສຳເລັດ");
    } finally {
      setSubmitting(false);
    }
  }

  function handleClearSelection() {
    if (submitting) return;
    setSelectedIds([]);
    setShowConfirm(false);
    setSubmitError("");
  }

  function handleEditVote() {
    if (!voteRecord || roomInfo?.status !== "open") return;
    setSelectedIds(voteRecord.selectedIds || []);
    saveVoteRecord(null);
    setShowConfirm(false);
    setSubmitError("");
  }

  function handleOpenConfirm() {
    if (selectedIds.length === 0) {
      showAlertDialog("ກະລຸນາເລືອກຢ່າງນ້ອຍ 1 ຄົນກ່ອນສົ່ງ", "ຈຳເປັນຕ້ອງເລືອກ");
      return;
    }

    setSubmitError("");
    setShowConfirm(true);
  }

  if (roomLoading) {
    return <LoadingState label={"ກຳລັງໂຫຼດຫ້ອງເລືອກຕັ້ງ..."} />;
  }

  if (roomNotFound) return null;

  if (roomError) {
    return (
      <ErrorState
        title={"ບໍ່ສາມາດໂຫຼດຫ້ອງເລືອກຕັ້ງໄດ້"}
        description={roomError}
        action={
          <button
            onClick={() => router.push("/my-rooms")}
            className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-indigo-700"
          >
            {"ກັບໄປລາຍການຫ້ອງ"}
          </button>
        }
      />
    );
  }

  if (!roomInfo) return null;

  if (voteRecord) {
    return (
      <div className="min-h-screen bg-slate-50">
        <RoomHeader />
        <div className="mx-auto max-w-lg px-4 py-4">
          {roomInfo.status === "open" ? (
            <RoomCountdownBanner
              endTime={roomInfo.endTime}
              startTime={roomInfo.startTime}
              durationMinutes={roomInfo.durationMinutes}
            />
          ) : null}
          <VoteStatusCard
            voteRecord={voteRecord}
            allowResultView={roomInfo.status === "closed"}
            onViewResult={() => router.push(`/vote-room/${roomCode}/result`)}
            onEditVote={roomInfo.status === "open" ? handleEditVote : undefined}
          />
        </div>
      </div>
    );
  }

  if (roomInfo.status === "pending") {
    return (
      <div className="min-h-screen bg-slate-50">
        <RoomHeader />
        <RoomStatePanel
          title={"ຫ້ອງເລືອກຕັ້ງຍັງບໍ່ທັນເລີ່ມ"}
          description={"ກະລຸນາກັບມາໃໝ່ເມື່ອຫ້ອງເປີດ."}
          actionLabel={"ອອກຈາກຫ້ອງ"}
          onAction={() => router.push("/my-rooms")}
        />
      </div>
    );
  }

  if (roomInfo.status === "draft") {
    return (
      <div className="min-h-screen bg-slate-50">
        <RoomHeader />
        <RoomStatePanel
          title={"ຫ້ອງຍັງບໍ່ພ້ອມໃຊ້ງານ"}
          description={"ຫ້ອງນີ້ຍັງບໍ່ໄດ້ເປີດໃຊ້ງານ. ກະລຸນາຕິດຕໍ່ຜູ້ດູແລລະບົບ."}
          actionLabel={"ອອກຈາກຫ້ອງ"}
          onAction={() => router.push("/my-rooms")}
        />
      </div>
    );
  }

  if (roomInfo.status === "closed") {
    return (
      <div className="min-h-screen bg-slate-50">
        <RoomHeader />
        <RoomStatePanel
          title={"ຫ້ອງເລືອກຕັ້ງປິດແລ້ວ"}
          description={"ໝົດເວລາການລົງຄະແນນສຽງແລ້ວ."}
          actionLabel={"ເບິ່ງຜົນການເລືອກຕັ້ງ"}
          onAction={() => router.push(`/vote-room/${roomCode}/result`)}
        />
      </div>
    );
  }

  const maxSelection = roomInfo.maxSelection || 1;
  const hasSelected = selectedIds.length > 0;
  const atMax = selectedIds.length >= maxSelection;

  return (
    <div className="min-h-screen bg-slate-50">
      <RoomHeader />

      <div className="mx-auto max-w-lg px-4 py-4">
        <RoomCountdownBanner
          endTime={roomInfo.endTime}
          startTime={roomInfo.startTime}
          durationMinutes={roomInfo.durationMinutes}
        />

        <div className="mb-4 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm leading-relaxed text-slate-600">
          {roomInfo.description}
        </div>

        {checkInError ? (
          <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
            {"ລະບົບກວດສອບການເຂົ້າຫ້ອງບໍ່ສໍາເລັດ. ທ່ານຍັງສາມາດລອງສົ່ງຄະແນນໄດ້"}
          </div>
        ) : null}

        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-slate-700">
              {"ລາຍຊື່ຜູ້ສະໝັກ"} ({candidates.length})
            </p>
            <StatusBadge
              label={`${"ເລືອກແລ້ວ"} ${selectedIds.length}/${maxSelection}`}
              tone={atMax ? "info" : "neutral"}
            />
          </div>
          {hasSelected ? (
            <button
              type="button"
              onClick={handleClearSelection}
              className="shrink-0 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50"
            >
              {"ລ້າງການເລືອກ"}
            </button>
          ) : null}
        </div>

        {maxSelection > 1 ? (
          <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
            {`ທ່ານເລືອກໄດ້ສູງສຸດ ${maxSelection} ຄົນ`}
          </div>
        ) : null}

        {candidates.length === 0 ? (
          <EmptyState
            title={"ລາຍຊື່ຜູ້ສະໝັກ"}
            description={"ຫ້ອງນີ້ຍັງບໍ່ມີຂໍ້ມູນຄະແນນ"}
          />
        ) : (
          <div className="mb-6 space-y-3">
            {candidates.map((candidate) => (
              <CandidateCard
                key={candidate.id}
                candidate={candidate}
                selected={selectedIds.includes(candidate.id)}
                onToggle={toggleCandidate}
                onPreview={setPreviewCandidate}
                disabled={false}
                maxSelection={maxSelection}
                currentSelectionCount={selectedIds.length}
              />
            ))}
          </div>
        )}

        {submitError ? (
          <p className="mb-4 text-center text-sm text-rose-600">
            {submitError}
          </p>
        ) : null}

        <div className="sticky bottom-0 border-t border-slate-200 bg-slate-50 pb-5 pt-3">
          <button
            onClick={handleOpenConfirm}
            disabled={!hasSelected}
            className="w-full rounded-xl bg-indigo-600 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {hasSelected
              ? "ສົ່ງຄະແນນ" + ` (${selectedIds.length})`
              : "ເລືອກຜູ້ສະໝັກເພື່ອດຳເນີນການ"}
          </button>
        </div>
      </div>

      {showConfirm ? (
        <VoteConfirmModal
          selectedIds={selectedIds}
          onCancel={() => setShowConfirm(false)}
          onConfirm={handleConfirmVote}
          submitting={submitting}
          submitError={submitError}
        />
      ) : null}

      <ImagePreviewModal
        open={!!previewCandidate}
        imageUrl={toDisplayAvatarUrl(
          previewCandidate?.avatar,
          previewCandidate?.name || "ຜູ້ສະໝັກບໍ່ຮູ້ຈັກ",
        )}
        title={previewCandidate?.name || "ຜູ້ສະໝັກບໍ່ຮູ້ຈັກ"}
        subtitle={previewCandidate?.title}
        onClose={() => setPreviewCandidate(null)}
      />
    </div>
  );
}
