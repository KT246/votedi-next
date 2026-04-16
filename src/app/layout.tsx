import type { Metadata } from "next";
import "./globals.css";
import UserSessionTimeoutWatcher from "../components/UserSessionTimeoutWatcher";

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
      className="h-full antialiased"
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col font-sans" suppressHydrationWarning>
        <UserSessionTimeoutWatcher />
        {children}
      </body>
    </html>
  );
}
