"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const navItems = [
    { href: "/feed", label: "Лента", short: "Лента", icon: "🏠" },
    { href: "/search", label: "Поиск", short: "Поиск", icon: "🔍" },
    { href: "/library", label: "Моя музыка", short: "Музыка", icon: "📚" },
    { href: "/friends", label: "Друзья", short: "Друзья", icon: "👥" },
    { href: "/profile", label: "Профиль", short: "Профиль", icon: "👤" },
];

export default function Sidebar() {
    const pathname = usePathname();

    // На странице входа меню не нужно
    if (pathname === "/login") return null;

    async function logout() {
        await createClient().auth.signOut();
        window.location.href = "/login";
    }

    function isActive(href: string) {
        return pathname === href || pathname.startsWith(href + "/");
    }

    const desktopLink = (active: boolean) =>
        [
            "flex items-center gap-4 rounded-xl px-4 py-4",
            "text-base font-medium transition-colors",
            active
                ? "bg-accent/15 text-accent"
                : "text-muted hover:bg-card-hover hover:text-foreground",
        ].join(" ");

    const mobileLink = (active: boolean) =>
        [
            "flex flex-1 flex-col items-center justify-center gap-0.5",
            "text-[11px] font-medium transition-colors",
            active ? "text-accent" : "text-muted",
        ].join(" ");

    return (
        <>
            {/* ===== Компьютер: боковое меню ===== */}
            <aside
                className={[
                    "fixed left-0 top-0 z-40 hidden h-screen w-64 flex-col",
                    "border-r border-border bg-card md:flex",
                ].join(" ")}
            >
                <Link
                    href="/feed"
                    className="flex h-20 items-center gap-3 border-b border-border px-6"
                >
                    <div
                        className={[
                            "flex h-10 w-10 items-center justify-center rounded-xl",
                            "bg-accent text-lg font-bold text-white",
                        ].join(" ")}
                    >
                        M
                    </div>
                    <span className="text-xl font-semibold tracking-tight">
            MusicApp
          </span>
                </Link>

                <nav className="flex-1 space-y-1 p-3">
                    {navItems.map((item) => (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={desktopLink(isActive(item.href))}
                        >
                            <span className="text-xl">{item.icon}</span>
                            {item.label}
                        </Link>
                    ))}
                </nav>

                <div className="space-y-3 border-t border-border p-4">
                    <button
                        onClick={logout}
                        className={[
                            "w-full rounded-xl border border-border px-4 py-3",
                            "text-sm font-medium text-muted transition-colors",
                            "hover:bg-card-hover hover:text-foreground",
                        ].join(" ")}
                    >
                        Выйти
                    </button>
                    <p className="text-xs text-muted">
                        Приватное приложение
                        <br />
                        для себя и друзей
                    </p>
                </div>
            </aside>

            {/* ===== Телефон: верхняя полоска ===== */}
            <header
                className={[
                    "fixed inset-x-0 top-0 z-40 flex h-14 items-center",
                    "justify-between border-b border-border bg-card px-4 md:hidden",
                ].join(" ")}
            >
                <Link href="/feed" className="flex items-center gap-2">
                    <div
                        className={[
                            "flex h-8 w-8 items-center justify-center rounded-lg",
                            "bg-accent text-sm font-bold text-white",
                        ].join(" ")}
                    >
                        M
                    </div>
                    <span className="font-semibold tracking-tight">MusicApp</span>
                </Link>

                <button
                    onClick={logout}
                    className={[
                        "rounded-lg border border-border px-3 py-1.5 text-sm text-muted",
                        "hover:bg-card-hover hover:text-foreground",
                    ].join(" ")}
                >
                    Выйти
                </button>
            </header>

            {/* ===== Телефон: нижняя панель ===== */}
            <nav
                className={[
                    "fixed inset-x-0 bottom-0 z-40 flex h-16",
                    "border-t border-border bg-card md:hidden",
                ].join(" ")}
            >
                {navItems.map((item) => (
                    <Link
                        key={item.href}
                        href={item.href}
                        className={mobileLink(isActive(item.href))}
                    >
                        <span className="text-xl leading-none">{item.icon}</span>
                        {item.short}
                    </Link>
                ))}
            </nav>
        </>
    );
}