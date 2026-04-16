"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, KeyRound } from "lucide-react";

import { useAdminAuthStore } from "../../../store/adminAuthStore";
import apiClient from "../../../api/apiClient";
import { showAlertDialog } from "../../../store/dialogStore";
import PageHeader from "../../../components/ui/PageHeader";

export default function AdminChangePasswordPage() {
  const adminUser = useAdminAuthStore((state) => state.adminUser);
  const adminId = adminUser?.id || "";
  const router = useRouter();

  const [form, setForm] = useState({ current: "", next: "" });
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNextPassword, setShowNextPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    if (!adminId || !adminUser?.username) {
      showAlertDialog("ຂໍ້ມູນແອັດມິນບໍ່ຄົບ", "ກະລຸນາເຂົ້າລະບົບໃໝ່");
      return;
    }

    if (!form.current.trim() || !form.next.trim()) {
      setError("ກະລຸນາປ້ອນລະຫັດຜ່ານເກົ່າ ແລະ ລະຫັດຜ່ານໃໝ່");
      return;
    }

    if (form.next.trim().length < 6) {
      setError("ລະຫັດຜ່ານໃໝ່ຕ້ອງຍາວຢ່າງນ້ອຍ 6 ຕົວອັກສອນ");
      return;
    }

    setSaving(true);
    setError("");
    try {
      const loginRes = await apiClient.post("/auth/login", {
        username: adminUser.username,
        password: form.current,
      });

      if (!((loginRes.data?.user?.id as string) || adminId)) {
        throw new Error("ບໍ່ພົບ admin ID");
      }

      await apiClient.patch("/admin/profile", {
        password: form.next,
      });

      router.push("/admin/dashboard");
    } catch (err: unknown) {
      const message =
        err && typeof err === "object" && "response" in err
          ? (err as { response?: { data?: { message?: string } } }).response?.data
              ?.message
          : undefined;
      setError(message || "ບໍ່ສາມາດປ່ຽນລະຫັດຜ່ານໄດ້");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="admin-page">
      <div className="admin-page-container max-w-3xl">
        <PageHeader
          title="ປ່ຽນລະຫັດຜ່ານ"
          subtitle={
            <>
              ບັນຊີ:{" "}
              <span className="font-mono text-[var(--admin-text)]">
                {adminUser?.username || "-"}
              </span>
            </>
          }
        />

        <div className="admin-card overflow-hidden">
          <div className="border-b border-[var(--admin-border)] bg-[var(--admin-surface-muted)] px-6 py-5">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--admin-accent-soft)] text-[var(--admin-accent)]">
                <KeyRound className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-[var(--admin-text)]">
                  ອັບເດດຂໍ້ມູນບັນຊີແອັດມິນ
                </p>
                <p className="mt-1 text-sm text-[var(--admin-text-muted)]">
                  ການປ່ຽນລະຫັດຜ່ານຈັດການຜ່ານ API ຂອງແອັບ ບໍ່ໄດ້ໃຊ້ Firebase Auth
                </p>
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5 px-6 py-6">
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                ລະຫັດຜ່ານປັດຈຸບັນ
              </label>
              <div className="relative">
                <input
                  type={showCurrentPassword ? "text" : "password"}
                  value={form.current}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, current: event.target.value }))
                  }
                  className="admin-input pr-11"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPassword((prev) => !prev)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--admin-text-muted)] transition-colors hover:text-[var(--admin-text)]"
                  aria-label={
                    showCurrentPassword
                      ? "ເຊື່ອງລະຫັດຜ່ານປັດຈຸບັນ"
                      : "ສະແດງລະຫັດຜ່ານປັດຈຸບັນ"
                  }
                >
                  {showCurrentPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                ລະຫັດຜ່ານໃໝ່
              </label>
              <div className="relative">
                <input
                  type={showNextPassword ? "text" : "password"}
                  value={form.next}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, next: event.target.value }))
                  }
                  className="admin-input pr-11"
                />
                <button
                  type="button"
                  onClick={() => setShowNextPassword((prev) => !prev)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--admin-text-muted)] transition-colors hover:text-[var(--admin-text)]"
                  aria-label={
                    showNextPassword
                      ? "ເຊື່ອງລະຫັດຜ່ານໃໝ່"
                      : "ສະແດງລະຫັດຜ່ານໃໝ່"
                  }
                >
                  {showNextPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            {error ? <div className="admin-notice-danger">{error}</div> : null}

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => router.back()}
                className="admin-btn-secondary flex-1"
              >
                ຍົກເລີກ
              </button>
              <button
                type="submit"
                disabled={saving}
                className="admin-btn-primary flex-1"
              >
                {saving ? "ກຳລັງບັນທຶກ..." : "ອັບເດດລະຫັດຜ່ານ"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
