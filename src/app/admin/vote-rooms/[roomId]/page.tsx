"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import {
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";
import Papa from "papaparse";
import { Download, Loader2, RefreshCw, Save, Upload } from "lucide-react";

import AdminRoute from "../../../../components/AdminRoute";
import EmptyState from "../../../../components/ui/EmptyState";
import ErrorState from "../../../../components/ui/ErrorState";
import LoadingState from "../../../../components/ui/LoadingState";
import StatusBadge from "../../../../components/ui/StatusBadge";
import { roomsApi } from "../../../../api/roomsApi";
import type { Candidate, VoteResult, VoteRoom } from "../../../../types";

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
      .split(";")
      .map((entry) => entry.trim())
      .filter(Boolean);
  }
  return [];
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
  const [candidateFileName, setCandidateFileName] = useState("");
  const [candidateDrafts, setCandidateDrafts] = useState<Candidate[]>([]);
  const [importError, setImportError] = useState("");
  const [importMessage, setImportMessage] = useState("");
  const [importing, setImporting] = useState(false);
  const [results, setResults] = useState<VoteResult[]>([]);
  const [resultsLoading, setResultsLoading] = useState(false);
  const [resultsError, setResultsError] = useState("");
  const roomKey = room?.id || room?.roomCode || roomId;

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

  const fetchResults = async () => {
    if (!roomKey) return;

    setResultsLoading(true);
    setResultsError("");
    try {
      const res = await roomsApi.getResults(roomKey);
      setResults(Array.isArray(res.data) ? res.data : []);
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

  const handleCandidateFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    setImportError("");
    setImportMessage("");
    setCandidateDrafts([]);
    setCandidateFileName("");

    if (!file) return;

    setCandidateFileName(file.name);
    Papa.parse<CandidateRow>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (parsed) => {
        const mapped = parsed.data
          .map((row, index) => {
            const candidate = normalizeCandidate(row, index);
            const hasMeaningfulValue =
              candidate.name ||
              candidate.title ||
              candidate.date ||
              (candidate.bio?.length || 0) > 0 ||
              candidate.avatar ||
              (candidate.achievements?.length || 0) > 0;
            return hasMeaningfulValue ? candidate : null;
          })
          .filter((item): item is Candidate => Boolean(item));

        if (mapped.length === 0) {
          setImportError("ບໍ່ພົບ candidate ໃນໄຟລ໌ CSV");
          return;
        }

        setCandidateDrafts(mapped);
      },
      error: () => {
        setImportError("ນຳເຂົ້າ CSV ບໍ່ສຳເລັດ");
      },
    });
  };

  const handleDownloadSampleCsv = () => {
    const csv = [
      "name,title,date,bio,avatar",
      '"ຜູ້ສະໝັກ 1","ຕຳແໜ່ງຕົວຢ່າງ","2026-03-31","ຈຸດເດັ່ນ 1;ຈຸດເດັ່ນ 2","https://drive.google.com/uc?export=view&id=FILE_ID"',
      '"ຜູ້ສະໝັກ 2","ຕຳແໜ່ງຕົວຢ່າງ","2025-12-01","ປະສົບການ 1;ປະສົບການ 2","https://drive.google.com/uc?export=view&id=FILE_ID_2"',
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "candidate-sample.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const handleImportCandidates = async () => {
    if (!room || !roomKey) return;
    if (candidateDrafts.length === 0) {
      setImportError("ກະລຸນາເລືອກໄຟລ໌ CSV ກ່ອນ");
      return;
    }

    setImporting(true);
    setImportError("");
    setImportMessage("");
    try {
      const res = await roomsApi.update(roomKey, {
        candidates: candidateDrafts,
      } as Partial<VoteRoom>);
      const updated = normalizeRoom(res.data, roomKey);
      setRoom(updated);
      syncFormFromRoom(updated);
      setCandidateDrafts(
        updated.candidates.map((item, index) =>
          normalizeCandidate(item, index),
        ),
      );
      setImportMessage(
        `ນຳເຂົ້າ candidate ${updated.candidates.length} ຄົນແລ້ວ`,
      );
    } catch (err: unknown) {
      const typedErr = err as {
        response?: { data?: { message?: string | string[] } };
        message?: string;
      };
      const message = typedErr?.response?.data?.message;
      setImportError(
        Array.isArray(message)
          ? message.join(", ")
          : message || typedErr?.message || "ນຳເຂົ້າ candidate ບໍ່ສຳເລັດ",
      );
    } finally {
      setImporting(false);
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
                    ນຳເຂົ້າຜູ້ສະໝັກ
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
                      <label className="mb-2 block text-sm font-medium text-slate-700">
                        ໄຟລ໌ CSV
                      </label>
                      <div className="flex flex-wrap items-center gap-3">
                        <input
                          type="file"
                          accept=".csv,text/csv"
                          onChange={handleCandidateFileChange}
                          className="block w-full flex-1 text-sm text-slate-600 file:mr-4 file:rounded-xl file:border-0 file:bg-indigo-600 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-indigo-700"
                        />
                        <button
                          type="button"
                          onClick={handleDownloadSampleCsv}
                          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
                        >
                          <Download className="h-4 w-4" />
                          ຕາມຕົວຢ່າງ CSV
                        </button>
                      </div>
                      <p className="mt-2 text-xs text-slate-500">
                        ຟອມທີ່ຮອງຮັບ: <code>name</code>, <code>title</code>,{" "}
                        <code>date</code>, <code>bio</code>, <code>avatar</code>
                      </p>
                    </div>

                    {candidateFileName ? (
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                        ໄຟລ໌ທີ່ເລືອກ:{" "}
                        <span className="font-semibold">
                          {candidateFileName}
                        </span>
                      </div>
                    ) : null}

                    {importError ? (
                      <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                        {importError}
                      </div>
                    ) : null}
                    {importMessage ? (
                      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                        {importMessage}
                      </div>
                    ) : null}

                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="text-sm text-slate-500">
                        ພົບຜູ້ສະໝັກທີ່ຈະນຳເຂົ້າ:{" "}
                        <span className="font-semibold text-slate-900">
                          {candidateDrafts.length}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => void handleImportCandidates()}
                        disabled={importing || candidateDrafts.length === 0}
                        className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {importing ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Upload className="h-4 w-4" />
                        )}
                        {importing ? "ກຳລັງນຳເຂົ້າ..." : "ນຳເຂົ້າຜູ້ສະໝັກ"}
                      </button>
                    </div>

                    {candidateDrafts.length === 0 ? (
                      <EmptyState
                        title="ຍັງບໍ່ມີ candidate ສຳລັບນຳເຂົ້າ"
                        description="ເລືອກໄຟລ໌ CSV ເພື່ອນຳເຂົ້າຂໍ້ມູນ candidate."
                      />
                    ) : (
                      <div className="overflow-hidden rounded-2xl border border-slate-200">
                        <table className="min-w-full divide-y divide-slate-200">
                          <thead className="bg-slate-50">
                            <tr>
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
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200">
                            {candidateDrafts.map((candidate) => (
                              <tr key={candidate.id} className="align-top">
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
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </AdminRoute>
  );
}
