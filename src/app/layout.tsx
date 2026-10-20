import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Sidebar from "@/components/Sidebar";
import { PlayerProvider } from "@/components/PlayerProvider";


const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin", "cyrillic"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "MusicApp — Приватная музыкальная библиотека",
  description: "Закрытое музыкальное приложение для себя и друзей",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ru"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
    <body className="min-h-full flex bg-background text-foreground">
    <PlayerProvider>
      <Sidebar />
      <main className="flex min-h-screen min-w-0 flex-1 flex-col pb-60 pt-14 md:ml-64 md:pb-44 md:pt-0">
        <div className="mx-auto w-full max-w-[1600px] flex-1 px-4 py-6 md:px-8 md:py-10 lg:px-12">
          {children}
        </div>
      </main>
    </PlayerProvider>
    </body>
    </html>
  );
}
