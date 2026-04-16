"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { getValidStoredUserToken } from "../lib/userSession";
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
      getValidStoredUserToken(localStorage) ||
      localStorage.getItem("userAccessToken") ||
      localStorage.getItem("accessToken");

    router.replace(token ? "/my-rooms" : "/login");
  }, [isLoggedIn, router]);

  return null;
}
