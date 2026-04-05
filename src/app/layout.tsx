import type { Metadata } from "next";
import { Noto_Sans_Lao } from "next/font/google";
import "./globals.css";
import UserSessionTimeoutWatcher from "../components/UserSessionTimeoutWatcher";

const notoSansLao = Noto_Sans_Lao({
  variable: "--font-noto-sans-lao",
  subsets: ["lao"],
  weight: ["400", "700"],
});

export const metadata: Metadata = {
  title: "ເວັບໂຫວດ - Web Vote",
  description: "ລະບົບການເລືອກຕັ້ງອອນໄລນ໌",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="lo"
      className={`${notoSansLao.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col font-sans" suppressHydrationWarning>
        <UserSessionTimeoutWatcher />
        {children}
      </body>
    </html>
  );
}
