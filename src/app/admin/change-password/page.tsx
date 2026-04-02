"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import { useAdminAuthStore } from "../../../store/adminAuthStore";
import { useAdminRole } from "../../../hooks/useAdminRole";
import apiClient from "../../../api/apiClient";
import { showAlertDialog } from "../../../store/dialogStore";

export default function AdminChangePasswordPage() {
  const { adminId } = useAdminRole();
  const adminUser = useAdminAuthStore((state) => state.adminUser);
  const router = useRouter();

  const [form, setForm] = useState({ current: "", next: "" });
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNextPassword, setShowNextPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    if (!adminId || !adminUser?.username) {
      showAlertDialog("ບໍ່ພົບຂໍ້ມູນຜູ້ດູແລ", "ກະລຸນາເຂົ້າລະບົບອີກຄັ້ງ");
      return;
    }

    if (!form.current.trim() || !form.next.trim()) {
      setError("ກະລຸນາກອກລະຫັດຜ່ານທັງສອງຊ່ອງ");
      return;
    }

    if (form.next.trim().length < 6) {
      setError("ລະຫັດຜ່ານໃໝ່ຕ້ອງມີຢ່າງນ້ອຍ 6 ຕົວອັກສອນ");
      return;
    }

    setSaving(true);
    setError("");
    try {
      const loginRes = await apiClient.post("/auth/login", {
        username: adminUser.username,
        password: form.current,
      });

      const authenticatedAdminId = (loginRes.data?.user?.id as string) || adminId;
      if (!authenticatedAdminId) {
        throw new Error('Admin ID is missing');
      }

      await apiClient.patch(`/admins/${authenticatedAdminId}`, {
        password: form.next,
      });

      router.push("/admin/dashboard");
    } catch (err: unknown) {
      const message =
        err && typeof err === "object" && "response" in err
          ? (err as { response?: { data?: { message?: string } } }).response
              ?.data?.message
          : undefined;
      setError(message || "ບໍ່ສາມາດປ່ຽນລະຫັດຜ່ານໄດ້");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-8">
      <div className="mx-auto max-w-lg">
        <div className="mb-6">
          <p className="text-sm font-medium text-slate-500">
            ບັນຊີ:{" "}
            <span className="font-mono text-slate-700">
              {adminUser?.username || "-"}
            </span>
          </p>
          <h1 className="mt-2 text-3xl font-bold text-slate-900">
            ປ່ຽນລະຫັດຜ່ານ
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            ປ່ຽນລະຫັດຜ່ານຂອງບັນຊີ admin ທີ່ກຳລັງໃຊ້ຢູ່
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="space-y-5 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"
        >
          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">
              ລະຫັດຜ່ານປັດຈຸບັນ
            </label>
            <div className="relative">
              <input
                type={showCurrentPassword ? "text" : "password"}
                value={form.current}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, current: event.target.value }))
                }
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 focus:border-indigo-300 focus:bg-white focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setShowCurrentPassword((prev) => !prev)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-indigo-600 hover:text-indigo-800"
                aria-label={
                  showCurrentPassword
                    ? "Hide current password"
                    : "Show current password"
                }
              >
                {showCurrentPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">
              ລະຫັດຜ່ານໃໝ່
            </label>
            <div className="relative">
              <input
                type={showNextPassword ? "text" : "password"}
                value={form.next}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, next: event.target.value }))
                }
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 focus:border-indigo-300 focus:bg-white focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setShowNextPassword((prev) => !prev)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-indigo-600 hover:text-indigo-800"
                aria-label={
                  showNextPassword ? "Hide new password" : "Show new password"
                }
              >
                {showNextPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {error ? <p className="text-sm text-rose-600">{error}</p> : null}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => router.back()}
              className="flex-1 rounded-xl border border-slate-200 py-3 text-sm font-medium text-slate-600 hover:bg-slate-50"
            >
              ຍົກເລີກ
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 rounded-xl bg-indigo-600 py-3 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-70"
            >
              {saving ? "ກຳລັງບັນທຶກ..." : "ປ່ຽນລະຫັດຜ່ານ"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
