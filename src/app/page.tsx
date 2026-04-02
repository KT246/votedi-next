"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "../store/authStore";

export default function Home() {
  const isLoggedIn = useAuthStore((state) => state.isLoggedIn);
  const router = useRouter();

  useEffect(() => {
    if (isLoggedIn) {
      router.replace("/my-rooms");
      return;
    }

    if (typeof window === "undefined") return;
    const token =
      localStorage.getItem("userAccessToken") ||
      localStorage.getItem("accessToken") ||
      (localStorage.getItem("vote_session")
        ? JSON.parse(localStorage.getItem("vote_session") || "{}").token
        : null);

    if (token) {
      router.replace("/my-rooms");
    }
  }, [isLoggedIn, router]);

  return (
    <div className="flex flex-col flex-1 items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex flex-1 w-full max-w-3xl flex-col items-center justify-between py-32 px-16 bg-white dark:bg-black sm:items-start">
        <h1 className="text-4xl font-bold mb-8">{"ຍິນດີຕ້ອນຮັບ"}</h1>
        <p className="text-lg mb-8">
          {
            "ລະບົບການເລືອກຕັ້ງອອນໄລນ໌. ສະແກນ QR ເພື່ອເຂົ້າຮ່ວມຫ້ອງເລືອກຕັ້ງ ຫຼື ລອງໃຊ້ງານຕົວຢ່າງດ້ານລຸ່ມ."
          }
        </p>
        <div className="flex gap-4">
          <Link
            href="/login"
            className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700"
          >
            {"ເຂົ້າລະບົບ"}
          </Link>
          <Link
            href="/admin/login"
            className="border border-blue-600 text-blue-600 px-6 py-3 rounded-lg hover:bg-blue-50"
          >
            {"ແດຊບອດ"}
          </Link>
        </div>
      </main>
    </div>
  );
}
