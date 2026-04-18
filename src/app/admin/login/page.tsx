"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, LockKeyhole, ShieldCheck } from "lucide-react";

import { useAdminAuthStore } from "../../../store/adminAuthStore";
import apiClient from "../../../lib/apiClient";

export default function AdminLoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const loginAdmin = useAdminAuthStore((state) => state.loginAdmin);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!username.trim() || !password.trim()) {
      setError("ກະລຸນາປ້ອນຊື່ຜູ້ໃຊ້ ແລະ ລະຫັດຜ່ານ");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await apiClient.post("/auth/login", {
        username: username.trim(),
        password,
      });

      const { accessToken, access_token, user } = res.data || {};
      const token = accessToken || access_token;
      if (!user || !token) {
        throw new Error("ຂໍ້ມູນຕອບກັບບໍ່ຖືກຕ້ອງ");
      }

      const admin = {
        id: user.id,
        username: user.username,
        fullName: user.fullName,
        role: user.role,
      };

      loginAdmin(admin, token);
      router.push("/admin/dashboard");
    } catch (err: unknown) {
      const typedErr = err as {
        response?: { data?: { message?: string | string[] } };
        message?: string;
      };
      const message = typedErr?.response?.data?.message;
      setError(
        Array.isArray(message)
          ? message.join(", ")
          : message || typedErr?.message || "ເຂົ້າລະບົບບໍ່ສຳເລັດ",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[var(--admin-bg)] px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-6xl items-center gap-8 lg:grid-cols-[1.05fr_0.95fr]">
        <section className="hidden lg:block">
          <div className="admin-card overflow-hidden">
            <div className="px-8 py-8">
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--admin-accent-soft)] text-[var(--admin-accent)]">
                  <ShieldCheck className="h-7 w-7" />
                </div>
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[var(--admin-text-muted)]">
                    VoteDI
                  </p>
                  <h1 className="mt-1 text-3xl font-bold tracking-tight text-[var(--admin-text)]">
                    ສູນຈັດການແອັດມິນ
                  </h1>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto w-full max-w-md">
          <div className="admin-card p-7 sm:p-8">
            <div className="mb-8">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--admin-accent-soft)] text-[var(--admin-accent)]">
                <LockKeyhole className="h-5 w-5" />
              </div>
              <h2 className="mt-5 text-2xl font-bold tracking-tight text-[var(--admin-text)]">
                ເຂົ້າລະບົບແອັດມິນ
              </h2>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                  ຊື່ຜູ້ໃຊ້
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(event) => {
                    setUsername(event.target.value);
                    setError("");
                  }}
                  placeholder="admin"
                  autoCapitalize="none"
                  autoCorrect="off"
                  className="admin-input"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                  ລະຫັດຜ່ານ
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(event) => {
                      setPassword(event.target.value);
                      setError("");
                    }}
                    placeholder="admin123"
                    autoCapitalize="none"
                    autoCorrect="off"
                    className="admin-input pr-11"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--admin-text-muted)] transition-colors hover:text-[var(--admin-text)]"
                    aria-label={showPassword ? "ເຊື່ອງລະຫັດຜ່ານ" : "ສະແດງລະຫັດຜ່ານ"}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              {error ? <div className="admin-notice-danger">{error}</div> : null}

              <button
                type="submit"
                disabled={loading}
                className="admin-btn-primary w-full py-3"
              >
                {loading ? (
                  <>
                    <span className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                    ກຳລັງເຂົ້າລະບົບ...
                  </>
                ) : (
                  "ເຂົ້າລະບົບ"
                )}
              </button>
            </form>
          </div>
        </section>
      </div>
    </div>
  );
}
