"use client";

import Link from "next/link";
import { useEffect, useSyncExternalStore } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  ChartColumnBig,
  ChevronRight,
  KeyRound,
  LogOut,
  ShieldCheck,
  Users,
  Vote,
} from "lucide-react";

import { useAdminAuthStore } from "../../store/adminAuthStore";

const navItems = [
  {
    href: "/admin/dashboard",
    label: "ພາບລວມ",
    description: "ພາບລວມລະບົບ",
    icon: ChartColumnBig,
  },
  {
    href: "/admin/users",
    label: "ຜູ້ມີສິດິໂຫວດ",
    description: "ຈັດການຂໍ້ມູນຜູ້ໃຊ້",
    icon: Users,
  },
  {
    href: "/admin/vote-rooms",
    label: "ຫ້ອງໂຫວດ",
    description: "ສ້າງ ແລະ ຕິດຕາມຫ້ອງ",
    icon: Vote,
  },
];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const adminUser = useAdminAuthStore((state) => state.adminUser);
  const logoutAdmin = useAdminAuthStore((state) => state.logoutAdmin);
  const router = useRouter();
  const pathname = usePathname();
  const currentPath = pathname ?? "";
  const hydrated = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  useEffect(() => {
    if (currentPath !== "/admin/login" && !adminUser) {
      router.replace("/admin/login");
    }
  }, [adminUser, currentPath, router]);

  const handleLogout = () => {
    logoutAdmin();
    router.push("/admin/login");
  };

  if (currentPath === "/admin/login") {
    return <>{children}</>;
  }

  if (!hydrated) {
    return <main className="min-h-screen bg-[var(--admin-bg)]" />;
  }

  return (
    <div className="min-h-screen bg-[var(--admin-bg)] text-[var(--admin-text)]">
      <div className="flex min-h-screen">
        <aside className="hidden w-[280px] shrink-0 border-r border-[var(--admin-sidebar-border)] bg-[var(--admin-sidebar)] px-5 py-6 text-[var(--admin-sidebar-text)] lg:flex lg:flex-col">
          <Link href="/admin/dashboard" className="block">
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--admin-accent-soft)] text-[var(--admin-accent)]">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-[var(--admin-sidebar-text)]">
                    VoteDI ຝັ່ງແອັດມິນ
                  </p>
                  <p className="mt-1 text-xs text-[var(--admin-sidebar-muted)]">
                    ຈັດການຂໍ້ມູນຜ່ານ Firestore
                  </p>
                </div>
              </div>
            </div>
          </Link>

          <nav className="mt-8 space-y-2">
            {navItems.map((item) => {
              const isActive =
                currentPath === item.href ||
                currentPath.startsWith(`${item.href}/`);
              const Icon = item.icon;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`admin-sidebar-link ${isActive ? "admin-sidebar-link-active" : ""}`}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">{item.label}</span>
                    <span className="mt-0.5 block truncate text-xs text-inherit/80">
                      {item.description}
                    </span>
                  </span>
                  <ChevronRight className="h-4 w-4 shrink-0 opacity-60" />
                </Link>
              );
            })}
          </nav>

          <div className="mt-auto rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className="text-xs uppercase tracking-[0.22em] text-[var(--admin-sidebar-muted)]">
              ກຳລັງໃຊ້ງານ
            </p>
            <p className="mt-3 text-sm font-semibold text-[var(--admin-sidebar-text)]">
              {adminUser?.fullName || adminUser?.username || "ແອັດມິນ"}
            </p>
            <p className="mt-1 text-xs text-[var(--admin-sidebar-muted)]">
              {adminUser?.role || "admin"}
            </p>
          </div>
        </aside>

        <div className="flex min-h-screen min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 border-b border-[var(--admin-border)] bg-white/90 backdrop-blur">
            <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6 lg:px-8">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--admin-text-muted)]">
                  ພື້ນທີ່ເຮັດວຽກແອັດມິນ
                </p>
                <p className="truncate text-sm text-[var(--admin-text)]">
                  ຈັດການຫ້ອງ, ຜູ້ໃຊ້ ແລະ ຜົນໂຫວດໃນບ່ອນດຽວ
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Link
                  href="/admin/change-password"
                  className="admin-btn-secondary"
                >
                  <KeyRound className="h-4 w-4" />
                  ປ່ຽນລະຫັດຜ່ານ
                </Link>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="admin-btn-secondary"
                >
                  <LogOut className="h-4 w-4" />
                  ອອກຈາກລະບົບ
                </button>
              </div>
            </div>

            <div className="border-t border-[var(--admin-border)] px-4 py-3 lg:hidden">
              <div className="flex gap-2 overflow-x-auto pb-1">
                {navItems.map((item) => {
                  const isActive =
                    currentPath === item.href ||
                    currentPath.startsWith(`${item.href}/`);
                  const Icon = item.icon;

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`inline-flex shrink-0 items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium ${
                        isActive
                          ? "border-[var(--admin-accent)] bg-[var(--admin-accent-soft)] text-[var(--admin-accent)]"
                          : "border-[var(--admin-border)] bg-white text-[var(--admin-text-muted)]"
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          </header>

          <main className="flex-1">{children}</main>
        </div>
      </div>
    </div>
  );
}
