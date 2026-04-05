"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import * as XLSX from "xlsx";
import {
  Download,
  Loader2,
  PencilLine,
  Plus,
  QrCode,
  RefreshCw,
  Save,
  Trash2,
} from "lucide-react";
import { QRCodeCanvas } from "qrcode.react";

import AdminRoute from "../../../../components/AdminRoute";
import EmptyState from "../../../../components/ui/EmptyState";
import ErrorState from "../../../../components/ui/ErrorState";
import ImagePreviewModal from "../../../../components/ImagePreviewModal";
import LoadingState from "../../../../components/ui/LoadingState";
import ModalShell from "../../../../components/ui/ModalShell";
import StatusBadge from "../../../../components/ui/StatusBadge";
import { roomsApi } from "../../../../api/roomsApi";
import type {
  Candidate,
  VoteParticipationRow,
  VoteResult,
  VoteRoom,
} from "../../../../types";
import { onAvatarError, toDisplayAvatarUrl } from "../../../../utils/avatar";

type RoomStatus = "draft" | "open" | "closed";
type RoomTimeMode = "duration" | "range";
type DetailTab = "import" | "results";

interface AdminRoom extends VoteRoom {
  createdAt?: string;
  updatedAt?: string;
  ownerAdminId?: string;
}

interface RoomFormState {
  roomName: string;
  description: string;
  status: RoomStatus;
  timeMode: RoomTimeMode;
  durationMinutes: number;
  startTime: string;
  endTime: string;
  maxSelection: number;
  allowResultView: boolean;
}

interface CandidateRow {
  id?: string;
  _id?: string;
  name?: string;
  fullName?: string;
  title?: string;
  date?: string;
  bio?: string | string[];
  avatar?: string;
}

interface CandidateFormState {
  name: string;
  title: string;
  date: string;
  avatar: string;
  bioText: string;
}

function normalizeString(value: unknown): string {
  return typeof value === "string" ? value.trim() : String(value || "").trim();
}

function normalizeStatus(value: unknown): RoomStatus {
  const raw = String(value || "")
    .trim()
    .toLowerCase();
  if (raw === "open" || raw === "closed") return raw;
  return "draft";
}

function normalizeRoomId(value: unknown): string {
  if (!value) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number") return String(value);
  if (typeof value === "object") {
    const raw = value as {
      $oid?: unknown;
      id?: unknown;
      _id?: unknown;
      toString?: () => string;
    };
    if (typeof raw.$oid === "string") return raw.$oid;
    if (typeof raw.id === "string") return raw.id;
    if (typeof raw._id === "string") return raw._id;
    if (typeof raw.toString === "function") {
      const result = raw.toString();
      if (result && result !== "[object Object]") return result;
    }
  }
  return String(value);
}

function toDatetimeLocal(value?: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

function fromDatetimeLocal(value: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function formatDate(value?: string): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("lo-LA", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function statusTone(
  status: RoomStatus,
): "info" | "warning" | "success" | "neutral" {
  if (status === "open") return "success";
  if (status === "draft") return "info";
  return "neutral";
}

const STATUS_LABELS: Record<RoomStatus, string> = {
  draft: "ຮ່າງ",
  open: "ເປີດ",
  closed: "ປິດ",
};

function normalizeBio(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((entry) => String(entry).trim()).filter(Boolean);
  }
  if (typeof value === "string") {
    return value
      .split(/[;\n]/g)
      .map((entry) => entry.trim())
      .filter(Boolean);
  }
  return [];
}

function splitBioText(value: string): string[] {
  return value
    .split(/[;\n]/g)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function normalizeCandidate(item: unknown, index: number): Candidate {
  const row = item as CandidateRow;
  const bio = normalizeBio(row.bio);
  const name =
    normalizeString(row.name || row.fullName) || `Candidate ${index + 1}`;
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 24);

  return {
    id:
      normalizeString(row.id ?? row._id) ||
      (slug ? `candidate-${index + 1}-${slug}` : `candidate-${index + 1}`),
    name,
    title: normalizeString(row.title),
    date: normalizeString(row.date),
    bio,
    shortBio: bio[0] || "",
    fullProfile: bio.join("; "),
    avatar: normalizeString(row.avatar),
    achievements: bio,
    voteCount: 0,
  };
}

function emptyCandidateForm(): CandidateFormState {
  return {
    name: "",
    title: "",
    date: "",
    avatar: "",
    bioText: "",
  };
}

function candidateToForm(candidate: Candidate | null): CandidateFormState {
  if (!candidate) return emptyCandidateForm();
  return {
    name: candidate.name || "",
    title: candidate.title || "",
    date: candidate.date || "",
    avatar: candidate.avatar || "",
    bioText: candidate.bio?.length
      ? candidate.bio.join("; ")
      : candidate.fullProfile || "",
  };
}

function candidateFormToDraft(
  form: CandidateFormState,
  fallbackId: string,
  existingVoteCount = 0,
): Candidate {
  const name = normalizeString(form.name);
  const title = normalizeString(form.title);
  const date = normalizeString(form.date);
  const avatar = normalizeString(form.avatar);
  const bio = splitBioText(form.bioText);
  return {
    id: fallbackId,
    name,
    title,
    date,
    bio,
    shortBio: bio[0] || "",
    fullProfile: bio.join("; "),
    avatar,
    achievements: bio,
    voteCount: existingVoteCount,
  };
}

function normalizeRoom(room: unknown, fallbackId = ""): AdminRoom {
  const item = room as Record<string, unknown>;
  return {
    id: normalizeRoomId(item.id ?? item._id) || fallbackId,
    roomCode: String(item.roomCode || ""),
    roomName: String(item.roomName || ""),
    description: String(item.description || ""),
    startTime: item.startTime ? String(item.startTime) : null,
    endTime: item.endTime ? String(item.endTime) : null,
    timeMode: item.timeMode === "range" ? "range" : "duration",
    durationMinutes:
      typeof item.durationMinutes === "number"
        ? item.durationMinutes
        : undefined,
    voteType:
      item.voteType === "single"
        ? "single"
        : item.voteType === "option"
          ? "option"
          : "multi",
    maxSelection: typeof item.maxSelection === "number" ? item.maxSelection : 1,
    status: normalizeStatus(item.status),
    allowResultView: Boolean(item.allowResultView),
    candidates: Array.isArray(item.candidates) ? item.candidates : [],
    allowedUsers: Array.isArray(item.allowedUsers) ? item.allowedUsers : [],
    ownerAdminId: normalizeRoomId(item.ownerAdminId),
    createdAt: item.createdAt ? String(item.createdAt) : undefined,
    updatedAt: item.updatedAt ? String(item.updatedAt) : undefined,
  };
}

export default function AdminVoteRoomDetailPage() {
  const params = useParams<{ roomId?: string | string[] }>();
  const roomParam = params?.roomId;
  const roomId = Array.isArray(roomParam) ? roomParam[0] : roomParam || "";

  const [room, setRoom] = useState<AdminRoom | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<DetailTab>("import");
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const [saveError, setSaveError] = useState("");
  const [form, setForm] = useState<RoomFormState>({
    roomName: "",
    description: "",
    status: "draft",
    timeMode: "duration",
    durationMinutes: 60,
    startTime: "",
    endTime: "",
    maxSelection: 1,
    allowResultView: true,
  });
  const [candidateDrafts, setCandidateDrafts] = useState<Candidate[]>([]);
  const [previewCandidate, setPreviewCandidate] = useState<Candidate | null>(null);
  const [candidateFormOpen, setCandidateFormOpen] = useState(false);
  const [candidateEditingIndex, setCandidateEditingIndex] = useState<number | null>(null);
  const [candidateForm, setCandidateForm] = useState<CandidateFormState>(
    emptyCandidateForm(),
  );
  const [candidateFormError, setCandidateFormError] = useState("");
  const [candidateSaving, setCandidateSaving] = useState(false);
  const [candidateStatusMessage, setCandidateStatusMessage] = useState("");
  const [candidateStatusError, setCandidateStatusError] = useState("");
  const [results, setResults] = useState<VoteResult[]>([]);
  const [participation, setParticipation] = useState<{
    eligibleCount: number;
    votedCount: number;
    notVotedCount: number;
    rows: VoteParticipationRow[];
  } | null>(null);
  const [resultsLoading, setResultsLoading] = useState(false);
  const [resultsError, setResultsError] = useState("");
  const [mounted, setMounted] = useState(false);
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const qrCanvasWrapRef = useRef<HTMLDivElement | null>(null);
  const roomKey = room?.id || room?.roomCode || roomId;
  const roomJoinUrl =
    mounted && room?.roomCode
      ? `${window.location.origin}/vote-room/${encodeURIComponent(
          room.roomCode,
        )}`
      : "";

  const syncFormFromRoom = (currentRoom: AdminRoom) => {
    setForm({
      roomName: currentRoom.roomName || "",
      description: currentRoom.description || "",
      status: normalizeStatus(currentRoom.status),
      timeMode: currentRoom.timeMode === "range" ? "range" : "duration",
      durationMinutes:
        typeof currentRoom.durationMinutes === "number" &&
        currentRoom.durationMinutes > 0
          ? currentRoom.durationMinutes
          : 60,
      startTime: toDatetimeLocal(currentRoom.startTime),
      endTime: toDatetimeLocal(currentRoom.endTime),
      maxSelection:
        typeof currentRoom.maxSelection === "number" &&
        currentRoom.maxSelection > 0
          ? currentRoom.maxSelection
          : 1,
      allowResultView: Boolean(currentRoom.allowResultView),
    });
    setCandidateDrafts(
      Array.isArray(currentRoom.candidates)
        ? currentRoom.candidates.map((item, index) =>
            normalizeCandidate(item, index),
          )
        : [],
    );
  };

  const fetchRoom = async () => {
    if (!roomId) {
      setError("Room not found");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");
    setSaveMessage("");
    setSaveError("");
    try {
      const res = await roomsApi.getById(roomId);
      const mapped = normalizeRoom(res.data, roomId);
      setRoom(mapped);
      syncFormFromRoom(mapped);
    } catch (err: unknown) {
      const typedErr = err as {
        response?: { data?: { message?: string | string[] } };
        message?: string;
      };
      const message = typedErr?.response?.data?.message;
      setError(
        Array.isArray(message)
          ? message.join(", ")
          : message || typedErr?.message || "ບໍ່ສາມາດໂຫຼດຫ້ອງໄດ້",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchRoom();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]);

  useEffect(() => {
    setMounted(true);
  }, []);

  const fetchResults = async () => {
    if (!roomKey) return;

    setResultsLoading(true);
    setResultsError("");
    try {
      const res = await roomsApi.getResults(roomKey);
      const payload = res.data as {
        results?: unknown;
        participation?: {
          eligibleCount?: number;
          votedCount?: number;
          notVotedCount?: number;
          rows?: VoteParticipationRow[];
        };
      };
      const mappedResults = Array.isArray(payload?.results)
        ? payload.results.map((item: unknown) => {
            const typedItem = item as { candidateId?: string; voteCount?: number };
            return {
              candidateId: String(typedItem.candidateId || "").trim(),
              voteCount: Number(typedItem.voteCount || 0),
            };
          }).filter((item) => item.candidateId)
        : [];
      setResults(mappedResults);
      setParticipation(
        payload?.participation
          ? {
              eligibleCount: Number(payload.participation.eligibleCount || 0),
              votedCount: Number(payload.participation.votedCount || 0),
              notVotedCount: Number(payload.participation.notVotedCount || 0),
              rows: Array.isArray(payload.participation.rows)
                ? payload.participation.rows
                : [],
            }
          : null,
      );
    } catch (err: unknown) {
      const typedErr = err as {
        response?: { data?: { message?: string | string[] } };
        message?: string;
      };
      const message = typedErr?.response?.data?.message;
      setResultsError(
        Array.isArray(message)
          ? message.join(", ")
          : message || typedErr?.message || "ບໍ່ສາມາດໂຫຼດຜົນໄດ້",
      );
      setParticipation(null);
    } finally {
      setResultsLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === "results" && room?.id) {
      void fetchResults();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, room?.id]);

  const mergedResults = useMemo(() => {
    const candidateMap = new Map(
      room?.candidates.map((candidate) => [candidate.id, candidate]) || [],
    );
    const resultMap = new Map(
      results.map((item) => [item.candidateId, item.voteCount]),
    );
    const orderedCandidateIds = new Set<string>();
    const rows = (room?.candidates || []).map((candidate) => {
      orderedCandidateIds.add(candidate.id);
      return {
        candidate,
        voteCount: resultMap.get(candidate.id) || 0,
      };
    });

    for (const result of results) {
      if (orderedCandidateIds.has(result.candidateId)) continue;
      rows.push({
        candidate:
          candidateMap.get(result.candidateId) ||
          ({
            id: result.candidateId,
            name: result.candidateId,
            title: "",
            date: "",
            bio: [],
            shortBio: "",
            fullProfile: "",
            avatar: "",
            achievements: [],
            voteCount: 0,
          } satisfies Candidate),
        voteCount: result.voteCount,
      });
    }

    return rows.sort((a, b) => b.voteCount - a.voteCount);
  }, [room?.candidates, results]);

  const totalVotes = useMemo(
    () => results.reduce((sum, item) => sum + item.voteCount, 0),
    [results],
  );

  const handleSaveRoom = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!room) return;

    if (
      room.status === "closed" &&
      (form.status === "open" || form.status === "draft")
    ) {
      const confirmed = window.confirm(
        "ຫ້ອງນີ້ປິດແລ້ວ. ຖ້າປ່ຽນເປັນ ຮ່າງ ຫຼື ເປີດ ອີກຄັ້ງ ຜົນຄະແນນເກົ່າຈະຖືກລົບອອກ ແລະຫ້ອງຈະຖືກຕັ້ງໃໝ່.",
      );
      if (!confirmed) return;
    }

    setSaving(true);
    setSaveError("");
    setSaveMessage("");
    try {
      const payload: Record<string, unknown> = {
        roomName: form.roomName.trim(),
        description: form.description.trim(),
        status: form.status,
        timeMode: form.timeMode,
        maxSelection:
          Number.isFinite(form.maxSelection) && form.maxSelection > 0
            ? form.maxSelection
            : 1,
        allowResultView: form.allowResultView,
        startTime:
          form.timeMode === "range" ? fromDatetimeLocal(form.startTime) : null,
        endTime:
          form.timeMode === "range" ? fromDatetimeLocal(form.endTime) : null,
      };

      if (form.timeMode === "duration") {
        payload.durationMinutes =
          Number.isFinite(form.durationMinutes) && form.durationMinutes > 0
            ? form.durationMinutes
            : 60;
      }

      const res = await roomsApi.update(roomKey, payload as Partial<VoteRoom>);
      const updated = normalizeRoom(res.data, roomKey);
      setRoom(updated);
      syncFormFromRoom(updated);
      setSaveMessage("ບັນທຶກຂໍ້ມູນແລ້ວ");
    } catch (err: unknown) {
      const typedErr = err as {
        response?: { data?: { message?: string | string[] } };
        message?: string;
      };
      const message = typedErr?.response?.data?.message;
      setSaveError(
        Array.isArray(message)
          ? message.join(", ")
          : message || typedErr?.message || "ບໍ່ສາມາດບັນທຶກຫ້ອງໄດ້",
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDownloadCandidateListXlsx = () => {
    if (candidateDrafts.length === 0) return;

    const rows = candidateDrafts.map((candidate) => ({
      name: candidate.name || "",
      title: candidate.title || "",
      date: candidate.date || "",
      bio: candidate.bio?.length
        ? candidate.bio.join("; ")
        : candidate.fullProfile || "",
      avatar: candidate.avatar || "",
    }));

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Candidates");
    XLSX.writeFile(workbook, "candidate-list.xlsx");
  };

  const handleDownloadRoomQr = () => {
    const canvas = qrCanvasWrapRef.current?.querySelector(
      "canvas",
    ) as HTMLCanvasElement | null;
    if (!canvas) return;
    const filenameBase = room?.roomCode || room?.roomName || "room";

    const link = document.createElement("a");
    link.href = canvas.toDataURL("image/png");
    link.download = `${filenameBase}-qr.png`;
    link.click();
  };

  const closeCandidateForm = () => {
    setCandidateFormOpen(false);
    setCandidateEditingIndex(null);
    setCandidateForm(emptyCandidateForm());
    setCandidateFormError("");
  };

  const openAddCandidateForm = () => {
    setCandidateEditingIndex(null);
    setCandidateForm(emptyCandidateForm());
    setCandidateFormError("");
    setCandidateFormOpen(true);
  };

  const openEditCandidateForm = (index: number) => {
    const candidate = candidateDrafts[index];
    if (!candidate) return;
    setCandidateEditingIndex(index);
    setCandidateForm(candidateToForm(candidate));
    setCandidateFormError("");
    setCandidateFormOpen(true);
  };

  const persistCandidateDrafts = async (
    nextCandidates: Candidate[],
    successMessage: string,
  ) => {
    if (!room || !roomKey) return false;

    setCandidateSaving(true);
    setCandidateStatusMessage("");
    setCandidateStatusError("");

    try {
      const res = await roomsApi.update(roomKey, {
        candidates: nextCandidates,
      } as Partial<VoteRoom>);
      const updated = normalizeRoom(res.data, roomKey);
      setRoom(updated);
      syncFormFromRoom(updated);
      setCandidateDrafts(
        updated.candidates.map((item, index) =>
          normalizeCandidate(item, index),
        ),
      );
      setCandidateStatusMessage(successMessage);
      return true;
    } catch (err: unknown) {
      const typedErr = err as {
        response?: { data?: { message?: string | string[] } };
        message?: string;
      };
      const message = typedErr?.response?.data?.message;
      setCandidateStatusError(
        Array.isArray(message)
          ? message.join(", ")
          : message || typedErr?.message || "ບໍ່ສາມາດບັນທຶກ candidate ໄດ້",
      );
      return false;
    } finally {
      setCandidateSaving(false);
    }
  };

  const handleSaveCandidateDraft = async () => {
    const name = normalizeString(candidateForm.name);
    if (!name) {
      setCandidateFormError("ກະລຸນາປ້ອນຊື່ candidate");
      return;
    }

    const existingIndex = candidateEditingIndex;
    const existingCandidate =
      existingIndex !== null ? candidateDrafts[existingIndex] : null;
    const fallbackId =
      existingCandidate?.id ||
      `candidate-${Date.now().toString(36)}-${Math.random()
        .toString(36)
        .slice(2, 8)}`;
    const nextCandidate = candidateFormToDraft(
      candidateForm,
      fallbackId,
      existingCandidate?.voteCount || 0,
    );
    const nextCandidates =
      existingIndex === null
        ? [...candidateDrafts, nextCandidate]
        : candidateDrafts.map((item, index) =>
            index === existingIndex ? nextCandidate : item,
          );

    const saved = await persistCandidateDrafts(
      nextCandidates,
      existingIndex === null
        ? `ເພີ່ມ candidate "${name}" ແລ້ວ`
        : `ບັນທຶກ candidate "${name}" ແລ້ວ`,
    );
    if (saved) closeCandidateForm();
  };

  const handleDeleteCandidateDraft = async (index: number) => {
    const candidate = candidateDrafts[index];
    if (!candidate) return;

    const confirmed = window.confirm(
      `ຕ້ອງການລົບ candidate "${candidate.name}" ຫຼືບໍ?`,
    );
    if (!confirmed) return;

    const nextCandidates = candidateDrafts.filter(
      (_, candidateIndex) => candidateIndex !== index,
    );
    const saved = await persistCandidateDrafts(
      nextCandidates,
      `ລົບ candidate "${candidate.name}" ແລ້ວ`,
    );
    if (!saved) return;

    if (candidateEditingIndex === index) {
      closeCandidateForm();
    } else if (candidateEditingIndex !== null && candidateEditingIndex > index) {
      setCandidateEditingIndex((prev) => (prev !== null ? prev - 1 : prev));
    }
  };

  if (loading) {
    return (
      <AdminRoute>
        <LoadingState label="ກຳລັງໂຫຼດລາຍລະອຽດຫ້ອງ..." />
      </AdminRoute>
    );
  }

  if (error || !room) {
    return (
      <AdminRoute>
        <div className="min-h-screen bg-slate-50 p-6">
          <div className="mx-auto max-w-5xl">
            <ErrorState
              title="ໂຫຼດຫ້ອງບໍ່ສຳເລັດ"
              description={error || "Room not found"}
              action={
                <Link
                  href="/admin/vote-rooms"
                  className="inline-flex rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-indigo-700"
                >
                  ກັບໄປລາຍການ
                </Link>
              }
            />
          </div>
        </div>
      </AdminRoute>
    );
  }
  return (
    <AdminRoute>
      <div className="min-h-screen bg-slate-50 p-6">
        <div className="mx-auto max-w-7xl space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <Link
                href="/admin/vote-rooms"
                className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-900"
              >
                <RefreshCw className="h-4 w-4" />
                ກັບໄປລາຍການຫ້ອງ
              </Link>
              <h1 className="mt-3 text-3xl font-bold text-slate-900">
                {room.roomName || "ລາຍລະອຽດຫ້ອງ"}
              </h1>
              <p className="mt-1 text-slate-500">
                ແກ້ໄຂຂໍ້ມູນຫ້ອງ, ນຳເຂົ້າ candidate ແລະເບິ່ງຜົນໄດ້ຈາກໜ້ານີ້
              </p>
            </div>
            <div className="flex items-center gap-3">
              <StatusBadge
                label={normalizeStatus(room.status)}
                tone={statusTone(normalizeStatus(room.status))}
              />
              <span className="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-mono text-slate-600">
                {room.roomCode || "-"}
              </span>
              <button
                type="button"
                onClick={() => setQrModalOpen(true)}
                disabled={!room.roomCode}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <QrCode className="h-4 w-4" />
                QR ຫ້ອງ
              </button>
            </div>
          </div>

          {saveMessage ? (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              {saveMessage}
            </div>
          ) : null}
          {saveError ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {saveError}
            </div>
          ) : null}

          <div className="grid gap-4 xl:grid-cols-[minmax(0,0.85fr)_minmax(0,0.85fr)]">
            <form
              onSubmit={handleSaveRoom}
              className="space-y-5 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"
            >
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                ແກ້ໄຂຂໍ້ມູນຫ້ອງ
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  ຊື່ຫ້ອງ
                </label>
                <input
                  value={form.roomName}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      roomName: event.target.value,
                    }))
                  }
                  required
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 focus:border-indigo-300 focus:bg-white focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  ຄຳອະທິບາຍ
                </label>
                <textarea
                  value={form.description}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      description: event.target.value,
                    }))
                  }
                  rows={4}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 focus:border-indigo-300 focus:bg-white focus:outline-none"
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">
                    ສະຖານະ
                  </label>
                  <select
                    value={form.status}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        status: event.target.value as RoomStatus,
                      }))
                    }
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 focus:border-indigo-300 focus:bg-white focus:outline-none"
                  >
                    <option value="draft">ຮ່າງ</option>
                    <option value="open">ເປີດ</option>
                    <option value="closed">ປິດ</option>
                  </select>
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">
                    ຮູບແບບການໂຫວດ
                  </label>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-semibold text-slate-700">
                    ເລືອກຫຼາຍຄົນ
                  </div>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">
                    ຮູບແບບເວລາ
                  </label>
                  <select
                    value={form.timeMode}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        timeMode: event.target.value as RoomTimeMode,
                      }))
                    }
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 focus:border-indigo-300 focus:bg-white focus:outline-none"
                  >
                    <option value="duration">ກຳນົດໄລຍະເວລາ</option>
                    <option value="range">ກຳນົດວັນເວລາ</option>
                  </select>
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">
                    ຈຳນວນເລືອກສູງສຸດ
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={form.maxSelection}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        maxSelection: Number(event.target.value) || 1,
                      }))
                    }
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 focus:border-indigo-300 focus:bg-white focus:outline-none"
                  />
                </div>
              </div>

              {form.timeMode === "duration" ? (
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">
                    ໄລຍະເວລາ (ນາທີ)
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={form.durationMinutes}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        durationMinutes: Number(event.target.value) || 60,
                      }))
                    }
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 focus:border-indigo-300 focus:bg-white focus:outline-none"
                  />
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-700">
                      ເລີ່ມຕົ້ນ
                    </label>
                    <input
                      type="datetime-local"
                      value={form.startTime}
                      onChange={(event) =>
                        setForm((prev) => ({
                          ...prev,
                          startTime: event.target.value,
                        }))
                      }
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 focus:border-indigo-300 focus:bg-white focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-700">
                      ສິ້ນສຸດ
                    </label>
                    <input
                      type="datetime-local"
                      value={form.endTime}
                      onChange={(event) =>
                        setForm((prev) => ({
                          ...prev,
                          endTime: event.target.value,
                        }))
                      }
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 focus:border-indigo-300 focus:bg-white focus:outline-none"
                    />
                  </div>
                </div>
              )}

              <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
                <input
                  type="checkbox"
                  checked={form.allowResultView}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      allowResultView: event.target.checked,
                    }))
                  }
                  className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-sm text-slate-700">
                  ອະນຸຍາດໃຫ້ເບິ່ງຜົນ
                </span>
              </label>

              <div className="flex flex-wrap items-center justify-end gap-3">
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {saving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  {saving ? "ກຳລັງບັນທຶກ..." : "ບັນທຶກ"}
                </button>
              </div>
            </form>

            <div className="rounded-3xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-200 px-6 pt-6">
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setActiveTab("import")}
                    className={`rounded-xl px-4 py-2 text-sm font-semibold transition-colors ${
                      activeTab === "import"
                        ? "bg-indigo-600 text-white"
                        : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                    }`}
                  >
                    ຈັດການຜູ້ສະໝັກ
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab("results")}
                    className={`rounded-xl px-4 py-2 text-sm font-semibold transition-colors ${
                      activeTab === "results"
                        ? "bg-indigo-600 text-white"
                        : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                    }`}
                  >
                    ເບິ່ງຜົນຄະແນນ
                  </button>
                </div>
              </div>

              <div className="p-6">
                {activeTab === "import" ? (
                  <div className="space-y-5">
                    <div>
                      <div className="flex items-center justify-end">
                        <button
                          type="button"
                          onClick={handleDownloadCandidateListXlsx}
                          disabled={candidateDrafts.length === 0}
                          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
                        >
                          <Download className="h-4 w-4" />
                          ດາວໂຫຼດລາຍຊື່ຂໍ້ມູນ
                        </button>
                      </div>
                      {candidateStatusError ? (
                        <div className="mt-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                          {candidateStatusError}
                        </div>
                      ) : null}
                      {candidateStatusMessage ? (
                        <div className="mt-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                          {candidateStatusMessage}
                        </div>
                      ) : null}
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="text-sm text-slate-500">
                        ພົບຜູ້ສະໝັກ:{" "}
                        <span className="font-semibold text-slate-900">
                          {candidateDrafts.length}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={openAddCandidateForm}
                          disabled={candidateSaving}
                          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
                        >
                          <Plus className="h-4 w-4" />
                          ເພີ່ມຂໍ້ມູນ
                        </button>
                      </div>
                    </div>

                    {candidateDrafts.length === 0 ? (
                      <EmptyState
                        title="ຍັງບໍ່ມີ candidate"
                        description="ເພີ່ມ candidate ເອງ ຫຼື ດາວໂຫຼດໄຟລ໌ຕົວຢ່າງເພື່ອແກ້ໄຂ."
                      />
                    ) : (
                      <div className="overflow-hidden rounded-2xl border border-slate-200">
                        <table className="min-w-full divide-y divide-slate-200">
                          <thead className="bg-slate-50">
                            <tr>
                              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                                รูป
                              </th>
                              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                                ຊື່
                              </th>
                              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                                ຕຳແໜ່ງ
                              </th>
                              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                                ວັນທີ
                              </th>
                              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                                bio
                              </th>
                              <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                                ຈັດການ
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200">
                            {candidateDrafts.map((candidate, index) => (
                              <tr key={candidate.id} className="align-top">
                                <td className="px-4 py-3">
                                  <button
                                    type="button"
                                    onClick={() => setPreviewCandidate(candidate)}
                                    className="block overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300"
                                    aria-label={`ເບິ່ງຮູບຂອງ ${candidate.name}`}
                                  >
                                    <img
                                      src={toDisplayAvatarUrl(candidate.avatar, candidate.name)}
                                      alt={candidate.name}
                                      onError={(event) => onAvatarError(event, candidate.name)}
                                      className="h-12 w-12 object-cover"
                                    />
                                  </button>
                                </td>
                                <td className="px-4 py-3 text-sm font-medium text-slate-900">
                                  {candidate.name}
                                </td>
                                <td className="px-4 py-3 text-sm text-slate-600">
                                  {candidate.title || "-"}
                                </td>
                                <td className="px-4 py-3 text-sm text-slate-600">
                                  {candidate.date || "-"}
                                </td>
                                <td className="px-4 py-3 text-sm text-slate-600">
                                  {candidate.bio?.length
                                    ? candidate.bio.join(" · ")
                                    : "-"}
                                </td>
                                <td className="px-4 py-3">
                                  <div className="flex justify-end gap-2">
                                    <button
                                      type="button"
                                      onClick={() => openEditCandidateForm(index)}
                                      disabled={candidateSaving}
                                      className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white p-2 text-slate-700 transition-colors hover:bg-slate-50"
                                      title="ແກ້ໄຂ"
                                    >
                                      <PencilLine className="h-4 w-4" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => void handleDeleteCandidateDraft(index)}
                                      disabled={candidateSaving}
                                      className="inline-flex items-center justify-center rounded-xl border border-rose-200 bg-white p-2 text-rose-600 transition-colors hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                                      title="ລົບ"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                      ຄະແນນລວມ:{" "}
                      <span className="font-semibold text-slate-900">
                        {totalVotes}
                      </span>
                    </div>

                    {participation ? (
                      <div className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-sm shadow-sm sm:grid-cols-3">
                        <div>
                          <p className="text-xs text-slate-500">ມີສິດທິທັງໝົດ</p>
                          <p className="text-lg font-bold text-slate-900">
                            {participation.eligibleCount}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-500">ໂຫວດແລ້ວ</p>
                          <p className="text-lg font-bold text-emerald-600">
                            {participation.votedCount}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-500">ງດ/ບໍ່ໄດ້ໂຫວດ</p>
                          <p className="text-lg font-bold text-amber-600">
                            {participation.notVotedCount}
                          </p>
                        </div>
                      </div>
                    ) : null}

                    {resultsLoading ? (
                      <LoadingState label="ກຳລັງໂຫຼດຜົນຄະແນນ..." />
                    ) : resultsError ? (
                      <ErrorState
                        title="ໂຫຼດຜົນຄະແນນບໍ່ສຳເລັດ"
                        description={resultsError}
                        action={
                          <button
                            type="button"
                            onClick={() => void fetchResults()}
                            className="inline-flex rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-indigo-700"
                          >
                            ລອງອີກຄັ້ງ
                          </button>
                        }
                      />
                    ) : mergedResults.length === 0 ? (
                      <EmptyState
                        title="ຍັງບໍ່ມີຜົນຄະແນນ"
                        description="ຫາກມີຄົນໂຫວດແລ້ວ ຜົນຈະຂຶ້ນໃນໜ້ານີ້."
                      />
                    ) : (
                      <div className="space-y-4">
                        <div className="overflow-hidden rounded-2xl border border-slate-200">
                          <table className="min-w-full divide-y divide-slate-200">
                            <thead className="bg-slate-50">
                              <tr>
                                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                                  ອັນດັບ
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                                  candidate
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                                  ຄະແນນ
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                                  ສັດສ່ວນ
                                </th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200">
                              {mergedResults.map((row, index) => {
                                const percentage =
                                  totalVotes > 0
                                    ? Math.round(
                                        (row.voteCount / totalVotes) * 100,
                                      )
                                    : 0;
                                return (
                                  <tr key={row.candidate.id}>
                                    <td className="px-4 py-3 text-sm font-semibold text-slate-900">
                                      {index + 1}
                                    </td>
                                    <td className="px-4 py-3">
                                      <div className="min-w-0">
                                        <p className="text-sm font-semibold text-slate-900">
                                          {row.candidate.name}
                                        </p>
                                        <p className="text-xs text-slate-500">
                                          {row.candidate.title || "-"}
                                        </p>
                                      </div>
                                    </td>
                                    <td className="px-4 py-3 text-sm font-semibold text-indigo-600">
                                      {row.voteCount}
                                    </td>
                                    <td className="px-4 py-3 text-sm text-slate-600">
                                      {percentage}%
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>

                        {participation?.rows?.length ? (
                          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                            <div className="border-b border-slate-200 px-4 py-3">
                              <p className="text-sm font-semibold text-slate-900">
                                ສະຖານະຜູ້ມີສິດທິໂຫວດ
                              </p>
                              <p className="text-xs text-slate-500">
                                ແອັດມິນຈະເຫັນວ່າໃຜໂຫວດແລ້ວ ແລະໃຜຍັງບໍ່ໄດ້ໂຫວດ
                              </p>
                            </div>
                            <div className="overflow-x-auto">
                              <table className="min-w-full divide-y divide-slate-200">
                                <thead className="bg-slate-50">
                                  <tr>
                                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                                      ຊື່
                                    </th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                                      Username
                                    </th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                                      ສະຖານະ
                                    </th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                                      ເວລາ
                                    </th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-200">
                                  {participation.rows.map((row) => (
                                    <tr key={row.userId}>
                                      <td className="px-4 py-3 text-sm font-medium text-slate-900">
                                        {row.fullName}
                                      </td>
                                      <td className="px-4 py-3 text-sm text-slate-600">
                                        {row.username}
                                      </td>
                                      <td className="px-4 py-3 text-sm">
                                        <span
                                          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                                            row.hasVoted
                                              ? "bg-emerald-50 text-emerald-700"
                                              : "bg-amber-50 text-amber-700"
                                          }`}
                                        >
                                          {row.hasVoted
                                            ? "ໂຫວດແລ້ວ"
                                            : "ງດອອກສຽງ / ບໍ່ໄດ້ໂຫວດ"}
                                        </span>
                                      </td>
                                      <td className="px-4 py-3 text-sm text-slate-600">
                                        {row.submittedAt
                                          ? new Date(
                                              row.submittedAt,
                                            ).toLocaleString("lo-LA", {
                                              dateStyle: "short",
                                              timeStyle: "short",
                                            })
                                          : "-"}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        ) : null}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <ModalShell
        open={candidateFormOpen}
        onClose={closeCandidateForm}
        title={candidateEditingIndex === null ? "ເພີ່ມ candidate" : "ແກ້ໄຂ candidate"}
        description="ກະລຸນາປ້ອນຂໍ້ມູນໃຫ້ຄົບ ແລ້ວຄ່ອຍກົດບັນທຶກ"
        maxWidthClass="max-w-lg"
        footer={
          <div className="flex gap-2">
            <button
              type="button"
              onClick={closeCandidateForm}
              className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50"
            >
              ຍົກເລີກ
            </button>
            <button
              type="button"
              onClick={handleSaveCandidateDraft}
              disabled={candidateSaving}
              className="flex-1 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {candidateSaving
                ? "ກຳລັງບັນທຶກ..."
                : candidateEditingIndex === null
                  ? "ເພີ່ມ"
                  : "ບັນທຶກ"}
            </button>
          </div>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">
              ຊື່
            </label>
            <input
              type="text"
              value={candidateForm.name}
              onChange={(event) =>
                setCandidateForm((prev) => ({
                  ...prev,
                  name: event.target.value,
                }))
              }
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 focus:border-indigo-300 focus:bg-white focus:outline-none"
              placeholder="ຜູ້ສະໝັກ 1"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">
              ຕຳແໜ່ງ
            </label>
            <input
              type="text"
              value={candidateForm.title}
              onChange={(event) =>
                setCandidateForm((prev) => ({
                  ...prev,
                  title: event.target.value,
                }))
              }
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 focus:border-indigo-300 focus:bg-white focus:outline-none"
              placeholder="ຕຳແໜ່ງຕົວຢ່າງ"
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                ວັນທີ
              </label>
              <input
                type="text"
                value={candidateForm.date}
                onChange={(event) =>
                  setCandidateForm((prev) => ({
                    ...prev,
                    date: event.target.value,
                  }))
                }
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 focus:border-indigo-300 focus:bg-white focus:outline-none"
                placeholder="2026-03-31"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                Avatar URL
              </label>
              <input
                type="url"
                value={candidateForm.avatar}
                onChange={(event) =>
                  setCandidateForm((prev) => ({
                    ...prev,
                    avatar: event.target.value,
                  }))
                }
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 focus:border-indigo-300 focus:bg-white focus:outline-none"
                placeholder="https://... หรือ Google Drive link"
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">
              BIO
            </label>
            <textarea
              value={candidateForm.bioText}
              onChange={(event) =>
                setCandidateForm((prev) => ({
                  ...prev,
                  bioText: event.target.value,
                }))
              }
              rows={5}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 focus:border-indigo-300 focus:bg-white focus:outline-none"
              placeholder="จุดเด่น 1; จุดเด่น 2"
            />
            <p className="mt-1 text-xs text-slate-500">
              แยกแต่ละข้อด้วยเครื่องหมาย `;` หรือขึ้นบรรทัดใหม่
            </p>
          </div>

          {candidateFormError ? (
            <p className="text-sm text-rose-600">{candidateFormError}</p>
          ) : null}
        </div>
      </ModalShell>

      <ImagePreviewModal
        open={!!previewCandidate}
        imageUrl={toDisplayAvatarUrl(
          previewCandidate?.avatar,
          previewCandidate?.name || "candidate",
        )}
        title={previewCandidate?.name || "candidate"}
        subtitle={previewCandidate?.title}
        onClose={() => setPreviewCandidate(null)}
      />

      <ModalShell
        open={qrModalOpen}
        onClose={() => setQrModalOpen(false)}
        title="QR ຫ້ອງ"
        description="ສະແກນ QR code ນີ້ເພື່ອເຂົ້າຫ້ອງໂຫວດໄດ້ທັນທີ"
        maxWidthClass="max-w-lg"
      >
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div
              ref={qrCanvasWrapRef}
              className="flex items-center justify-center rounded-2xl bg-white p-5"
            >
              {roomJoinUrl ? (
                <QRCodeCanvas
                  value={roomJoinUrl}
                  size={240}
                  level="M"
                  includeMargin
                />
              ) : null}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
            <p className="font-semibold text-slate-900">{room.roomName}</p>
            <p className="mt-1 text-slate-500">
              ລະຫັດຫ້ອງ:{" "}
              <a
                href={roomJoinUrl || `/vote-room/${room.roomCode}`}
                target="_blank"
                rel="noreferrer"
                className="font-mono text-indigo-600 underline decoration-indigo-300 underline-offset-2 transition-colors hover:text-indigo-700"
              >
                {roomJoinUrl || `/vote-room/${room.roomCode}`}
              </a>
            </p>
          </div>

          <button
            type="button"
            onClick={handleDownloadRoomQr}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-indigo-700"
          >
            <Download className="h-4 w-4" />
            ດາວໂຫຼດ QR
          </button>
        </div>
      </ModalShell>
    </AdminRoute>
  );
}
