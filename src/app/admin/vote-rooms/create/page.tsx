"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import AdminRoute from "../../../../components/AdminRoute";
import ErrorState from "../../../../components/ui/ErrorState";
import PageHeader from "../../../../components/ui/PageHeader";
import { roomsApi } from "../../../../api/roomsApi";

export default function AdminVoteRoomCreateRoute() {
  const router = useRouter();
  const [roomName, setRoomName] = useState("");
  const [description, setDescription] = useState("");
  const [maxSelection, setMaxSelection] = useState(1);
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [allowResultView, setAllowResultView] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const payload = {
        roomName: roomName.trim(),
        description: description.trim(),
        voteType: "multi" as const,
        maxSelection:
          Number.isFinite(maxSelection) && maxSelection > 0 ? maxSelection : 1,
        timeMode: "duration" as const,
        durationMinutes:
          Number.isFinite(durationMinutes) && durationMinutes > 0
            ? durationMinutes
            : 60,
        allowResultView,
        status: "draft" as const,
      };
      const res = await roomsApi.create(payload);
      const roomId = String(res.data?.id || res.data?._id || "");
      router.push(roomId ? `/admin/vote-rooms/${roomId}` : "/admin/vote-rooms");
    } catch (err: unknown) {
      const typedErr = err as {
        response?: { data?: { message?: string | string[] } };
        message?: string;
      };
      const message = typedErr?.response?.data?.message;
      setError(
        Array.isArray(message)
          ? message.join(", ")
          : message || typedErr?.message || "ບໍ່ສາມາດສ້າງຫ້ອງໄດ້",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AdminRoute>
      <div className="admin-page">
        <div className="admin-page-container max-w-4xl space-y-6">
          <PageHeader
            title="ສ້າງຫ້ອງໂຫວດ"
            subtitle="ເລີ່ມຈາກຫ້ອງຮ່າງ ແລ້ວຄ່ອຍເພີ່ມຜູ້ສະໝັກໃນໜ້າລາຍລະອຽດ"
            actions={
              <Link href="/admin/vote-rooms" className="admin-btn-secondary">
                ກັບໄປລາຍການຫ້ອງ
              </Link>
            }
          />

          {error ? (
            <ErrorState
              title="ສ້າງຫ້ອງບໍ່ສຳເລັດ"
              description={error}
              action={
                <button
                  type="button"
                  onClick={() => setError("")}
                  className="admin-btn-secondary"
                >
                  ປິດ
                </button>
              }
            />
          ) : null}

          <form onSubmit={handleSubmit} className="admin-card overflow-hidden">
            <div className="border-b border-[var(--admin-border)] bg-[var(--admin-surface-muted)] px-6 py-5">
              <h2 className="text-lg font-semibold text-[var(--admin-text)]">
                ຕັ້ງຄ່າຫ້ອງ
              </h2>
              <p className="mt-1 text-sm text-[var(--admin-text-muted)]">
                ໃສ່ຂໍ້ມູນພື້ນຖານກ່ອນ ແລ້ວຈັດການຜູ້ສະໝັກ ແລະ ຜົນໃນໜ້າລາຍລະອຽດ
              </p>
            </div>

            <div className="space-y-5 px-6 py-6">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  ຊື່ຫ້ອງ
                </label>
                <input
                  value={roomName}
                  onChange={(event) => setRoomName(event.target.value)}
                  required
                  className="admin-input"
                  placeholder="ການເລືອກຕັ້ງ 2026"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  ຄຳອະທິບາຍ
                </label>
                <textarea
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  rows={4}
                  className="admin-textarea"
                  placeholder="ບັນທຶກສັ້ນໆກ່ຽວກັບຫ້ອງນີ້"
                />
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">
                    ຈຳນວນເລືອກສູງສຸດ
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={maxSelection}
                    onChange={(event) =>
                      setMaxSelection(Number(event.target.value) || 1)
                    }
                    className="admin-input"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">
                    ໄລຍະເວລາ (ນາທີ)
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={durationMinutes}
                    onChange={(event) =>
                      setDurationMinutes(Number(event.target.value) || 60)
                    }
                    className="admin-input"
                    placeholder="60"
                  />
                  <p className="mt-2 text-xs text-[var(--admin-text-muted)]">
                    ຫ້ອງຈະໃຊ້ໂໝດກຳນົດເວລາແບບນາທີໃນຂັ້ນຕົ້ນ
                  </p>
                </div>
                <div className="admin-card-muted px-4 py-3 md:col-span-2">
                  <p className="text-sm font-medium text-slate-700">ປະເພດການໂຫວດ</p>
                  <p className="mt-1 text-sm text-[var(--admin-text-muted)]">
                    ຫ້ອງໂຫວດເລືອກໄດ້ຫຼາຍຄົນ
                  </p>
                </div>
              </div>

              <label className="flex items-center gap-3 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface-muted)] px-4 py-3">
                <input
                  type="checkbox"
                  checked={allowResultView}
                  onChange={(event) => setAllowResultView(event.target.checked)}
                  className="admin-checkbox"
                />
                <span className="text-sm text-slate-700">
                  ອະນຸຍາດເບິ່ງຜົນເມື່ອຫ້ອງຖືກປິດ
                </span>
              </label>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-3 border-t border-[var(--admin-border)] bg-[var(--admin-surface-muted)] px-6 py-4">
              <Link href="/admin/vote-rooms" className="admin-btn-secondary">
                ຍົກເລີກ
              </Link>
              <button
                type="submit"
                disabled={submitting}
                className="admin-btn-primary"
              >
                {submitting ? "ກຳລັງສ້າງ..." : "ສ້າງຫ້ອງ"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </AdminRoute>
  );
}
