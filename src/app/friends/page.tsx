"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { usePlayer } from "@/components/PlayerProvider";
import { toPlayerTrack } from "@/lib/tracks";
import Link from "next/link";

type Profile = {
    id: string;
    username: string;
    avatar_url: string | null;
};

type Friendship = {
    id: string;
    requester_id: string;
    addressee_id: string;
    status: "pending" | "accepted";
};

type FriendTrack = {
    id: string;
    owner_id: string;
    title: string;
    artist: string | null;
    file_path: string;
    cover_url?: string | null;
    visibility?: "private" | "friends";
    created_at?: string;
    profiles?: { username: string; avatar_url: string | null } | null;
};

function Avatar({ profile }: { profile?: Profile }) {
    if (profile?.avatar_url) {
        return (
            // eslint-disable-next-line @next/next/no-img-element
            <img
                src={profile.avatar_url}
                alt=""
                className="h-10 w-10 shrink-0 rounded-full object-cover"
            />
        );
    }

    return (
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-purple-700 font-bold">
            {profile?.username?.trim().charAt(0).toUpperCase() || "♫"}
        </div>
    );
}

export default function FriendsPage() {
    const supabase = createClient();
    const { playQueue, addToQueue, isQueued, current } = usePlayer();

    const [userId, setUserId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [message, setMessage] = useState("");

    const [friendships, setFriendships] = useState<Friendship[]>([]);
    const [profiles, setProfiles] = useState<Record<string, Profile>>({});
    const [friendTracks, setFriendTracks] = useState<FriendTrack[]>([]);

    const [query, setQuery] = useState("");
    const [results, setResults] = useState<Profile[]>([]);
    const [searching, setSearching] = useState(false);

    useEffect(() => {
        async function init() {
            const {
                data: { user },
            } = await supabase.auth.getUser();

            if (!user) {
                window.location.href = "/login";
                return;
            }

            setUserId(user.id);
            await loadAll(user.id);
            setLoading(false);
        }

        void init();
    }, []);

    async function loadAll(uid: string) {
        const { data: fsData, error: fsError } = await supabase
            .from("friendships")
            .select("id, requester_id, addressee_id, status");

        if (fsError) {
            setMessage(`Ошибка загрузки друзей: ${fsError.message}`);
            return;
        }

        const list = (fsData ?? []) as Friendship[];
        setFriendships(list);

        const otherIds = Array.from(
            new Set(
                list.map((f) =>
                    f.requester_id === uid ? f.addressee_id : f.requester_id
                )
            )
        );

        if (otherIds.length === 0) {
            setProfiles({});
            setFriendTracks([]);
            return;
        }

        const { data: profData } = await supabase
            .from("profiles")
            .select("id, username, avatar_url")
            .in("id", otherIds);

        const map: Record<string, Profile> = {};
        (profData ?? []).forEach((p) => {
            map[p.id] = p as Profile;
        });
        setProfiles(map);

        const friendIds = list
            .filter((f) => f.status === "accepted")
            .map((f) => (f.requester_id === uid ? f.addressee_id : f.requester_id));

        if (friendIds.length === 0) {
            setFriendTracks([]);
            return;
        }

        // База сама отдаст только треки с доступом «Друзья»
        const { data: trackData } = await supabase
            .from("tracks")
            .select("id, owner_id, title, artist, file_path, cover_url") // <--- ДОБАВИЛИ cover_url
            .in("owner_id", friendIds)
            .eq("visibility", "friends")
            .order("created_at", { ascending: false });

        setFriendTracks((trackData ?? []) as FriendTrack[]);
    }

    function otherId(f: Friendship) {
        return f.requester_id === userId ? f.addressee_id : f.requester_id;
    }

    function relationWith(profileId: string) {
        return friendships.find(
            (f) => f.requester_id === profileId || f.addressee_id === profileId
        );
    }

    async function search(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (!userId) return;

        const text = query.trim();
        if (text.length < 2) {
            setMessage("Введи минимум 2 символа для поиска.");
            return;
        }

        setSearching(true);
        setMessage("");

        // Экранируем служебные символы шаблона поиска
        const safe = text.replace(/[\\%_]/g, (c) => `\\${c}`);

        const { data, error } = await supabase
            .from("profiles")
            .select("id, username, avatar_url")
            .ilike("username", `%${safe}%`)
            .neq("id", userId)
            .limit(10);

        if (error) {
            setMessage(`Ошибка поиска: ${error.message}`);
        } else {
            setResults((data ?? []) as Profile[]);
            if (!data || data.length === 0) setMessage("Никого не нашли.");
        }

        setSearching(false);
    }

    async function sendRequest(profile: Profile) {
        if (!userId) return;

        const { error } = await supabase.from("friendships").insert({
            requester_id: userId,
            addressee_id: profile.id,
        });

        if (error) {
            setMessage(`Не удалось отправить заявку: ${error.message}`);
            return;
        }

        setMessage(`Заявка отправлена: ${profile.username}`);
        await loadAll(userId);
    }

    async function acceptRequest(f: Friendship) {
        if (!userId) return;

        const { error } = await supabase
            .from("friendships")
            .update({ status: "accepted" })
            .eq("id", f.id);

        if (error) {
            setMessage(`Не удалось принять заявку: ${error.message}`);
            return;
        }

        await loadAll(userId);
    }

    async function removeFriendship(f: Friendship, confirmText?: string) {
        if (!userId) return;
        if (confirmText && !window.confirm(confirmText)) return;

        const { error } = await supabase
            .from("friendships")
            .delete()
            .eq("id", f.id);

        if (error) {
            setMessage(`Не удалось выполнить действие: ${error.message}`);
            return;
        }

        await loadAll(userId);
    }

    function playFriendTracks(startIndex: number) {
        playQueue(
            friendTracks.map((t) => toPlayerTrack(t as any, userId)),
            startIndex
        );
    }

    if (loading) {
        return (
            <main className="flex min-h-screen items-center justify-center bg-neutral-950 text-white">
                Загружаем друзей...
            </main>
        );
    }

    const incoming = friendships.filter(
        (f) => f.status === "pending" && f.addressee_id === userId
    );
    const outgoing = friendships.filter(
        (f) => f.status === "pending" && f.requester_id === userId
    );
    const friends = friendships.filter((f) => f.status === "accepted");

    return (
        <main className="min-h-screen bg-neutral-950 px-5 py-12 text-white">
            <div className="mx-auto max-w-2xl space-y-8">
                <header className="flex items-center justify-between">
                    <Link href="/" className="text-xl font-bold">
                        🎵 MusicApp
                    </Link>

                    <nav className="flex gap-2">
                        <Link
                            href="/library"
                            className="rounded-xl border border-white/10 px-4 py-2 text-sm hover:bg-neutral-800"
                        >
                            Моя музыка
                        </Link>
                        <Link
                            href="/profile"
                            className="rounded-xl border border-white/10 px-4 py-2 text-sm hover:bg-neutral-800"
                        >
                            Профиль
                        </Link>
                    </nav>
                </header>

                <section className="rounded-3xl border border-white/10 bg-neutral-900 p-6 sm:p-8">
                    <h1 className="text-3xl font-bold">Друзья</h1>
                    <p className="mt-2 text-neutral-400">
                        Найди друзей по имени пользователя и слушай их музыку.
                    </p>

                    <form onSubmit={search} className="mt-6 flex gap-2">
                        <input
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="Имя пользователя"
                            maxLength={30}
                            className="min-w-0 flex-1 rounded-xl border border-white/10 bg-neutral-800 px-4 py-3 outline-none focus:border-purple-500"
                        />
                        <button
                            type="submit"
                            disabled={searching}
                            className="rounded-xl bg-purple-600 px-5 py-3 font-semibold hover:bg-purple-500 disabled:opacity-50"
                        >
                            {searching ? "..." : "Найти"}
                        </button>
                    </form>

                    {message && (
                        <p role="status" className="mt-4 text-sm text-neutral-300">
                            {message}
                        </p>
                    )}

                    {results.length > 0 && (
                        <ul className="mt-4 space-y-2">
                            {results.map((p) => {
                                const rel = relationWith(p.id);

                                let action: React.ReactNode;
                                if (!rel) {
                                    action = (
                                        <button
                                            onClick={() => sendRequest(p)}
                                            className="rounded-lg bg-purple-600 px-3 py-1.5 text-sm font-semibold hover:bg-purple-500"
                                        >
                                            Добавить
                                        </button>
                                    );
                                } else if (rel.status === "accepted") {
                                    action = (
                                        <span className="text-sm text-green-400">Друзья</span>
                                    );
                                } else if (rel.requester_id === userId) {
                                    action = (
                                        <span className="text-sm text-neutral-400">
                      Заявка отправлена
                    </span>
                                    );
                                } else {
                                    action = (
                                        <button
                                            onClick={() => acceptRequest(rel)}
                                            className="rounded-lg bg-purple-600 px-3 py-1.5 text-sm font-semibold hover:bg-purple-500"
                                        >
                                            Принять заявку
                                        </button>
                                    );
                                }

                                return (
                                    <li
                                        key={p.id}
                                        className="flex items-center justify-between gap-3 rounded-xl bg-neutral-800 p-3"
                                    >
                                        <div className="flex min-w-0 items-center gap-3">
                                            <Avatar profile={p} />
                                            <span className="truncate font-medium">
                        {p.username}
                      </span>
                                        </div>
                                        {action}
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </section>

                {incoming.length > 0 && (
                    <section className="rounded-3xl border border-purple-500/30 bg-neutral-900 p-6 sm:p-8">
                        <h2 className="text-xl font-bold">Входящие заявки</h2>
                        <ul className="mt-4 space-y-2">
                            {incoming.map((f) => {
                                const p = profiles[otherId(f)];
                                return (
                                    <li
                                        key={f.id}
                                        className="flex items-center justify-between gap-3 rounded-xl bg-neutral-800 p-3"
                                    >
                                        <div className="flex min-w-0 items-center gap-3">
                                            <Avatar profile={p} />
                                            <span className="truncate font-medium">
                        {p?.username ?? "Пользователь"}
                      </span>
                                        </div>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => acceptRequest(f)}
                                                className="rounded-lg bg-purple-600 px-3 py-1.5 text-sm font-semibold hover:bg-purple-500"
                                            >
                                                Принять
                                            </button>
                                            <button
                                                onClick={() => removeFriendship(f)}
                                                className="rounded-lg border border-white/10 px-3 py-1.5 text-sm hover:bg-neutral-700"
                                            >
                                                Отклонить
                                            </button>
                                        </div>
                                    </li>
                                );
                            })}
                        </ul>
                    </section>
                )}

                {outgoing.length > 0 && (
                    <section className="rounded-3xl border border-white/10 bg-neutral-900 p-6 sm:p-8">
                        <h2 className="text-xl font-bold">Отправленные заявки</h2>
                        <ul className="mt-4 space-y-2">
                            {outgoing.map((f) => {
                                const p = profiles[otherId(f)];
                                return (
                                    <li
                                        key={f.id}
                                        className="flex items-center justify-between gap-3 rounded-xl bg-neutral-800 p-3"
                                    >
                                        <div className="flex min-w-0 items-center gap-3">
                                            <Avatar profile={p} />
                                            <span className="truncate font-medium">
                        {p?.username ?? "Пользователь"}
                      </span>
                                        </div>
                                        <button
                                            onClick={() => removeFriendship(f)}
                                            className="rounded-lg border border-white/10 px-3 py-1.5 text-sm hover:bg-neutral-700"
                                        >
                                            Отменить
                                        </button>
                                    </li>
                                );
                            })}
                        </ul>
                    </section>
                )}

                <section className="rounded-3xl border border-white/10 bg-neutral-900 p-6 sm:p-8">
                    <h2 className="text-xl font-bold">Мои друзья ({friends.length})</h2>

                    {friends.length === 0 ? (
                        <p className="mt-4 text-neutral-500">
                            Пока никого. Найди друга по имени выше.
                        </p>
                    ) : (
                        <ul className="mt-4 space-y-2">
                            {friends.map((f) => {
                                const p = profiles[otherId(f)];
                                return (
                                    <li
                                        key={f.id}
                                        className="flex items-center justify-between gap-3 rounded-xl bg-neutral-800 p-3"
                                    >
                                        <div className="flex min-w-0 items-center gap-3">
                                            <Avatar profile={p} />
                                            <span className="truncate font-medium">
                        {p?.username ?? "Пользователь"}
                      </span>
                                        </div>
                                        <button
                                            onClick={() =>
                                                removeFriendship(
                                                    f,
                                                    `Удалить ${p?.username ?? "пользователя"} из друзей?`
                                                )
                                            }
                                            className="text-sm text-red-400 hover:text-red-300"
                                        >
                                            Удалить
                                        </button>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </section>

                <section className="rounded-3xl border border-white/10 bg-neutral-900 p-6 sm:p-8">
                    <h2 className="text-xl font-bold">Музыка друзей</h2>

                    {friendTracks.length === 0 ? (
                        <p className="mt-4 text-neutral-500">
                            Друзья пока не открыли ни одной песни.
                        </p>
                    ) : (
                        <ul className="mt-4 space-y-3">
                            {friendTracks.map((t, i) => {
                                const isCurrent = current?.id === t.id;
                                const queued = isQueued(t.id);

                                return (
                                    <li key={t.id} className={`rounded-xl bg-neutral-800 p-4 ${isCurrent ? 'border border-green-500/60' : ''}`}>
                                        <div className="flex items-center justify-between gap-3">

                                            {/* --- БЛОК С ОБЛОЖКОЙ ДЛЯ ДРУЗЕЙ --- */}
                                            <div className="flex min-w-0 items-center gap-3">
                                                <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-neutral-900 flex items-center justify-center border border-white/5">
                                                    {t.cover_url ? (
                                                        // eslint-disable-next-line @next/next/no-img-element
                                                        <img src={t.cover_url} alt="cover" className="h-full w-full object-cover" />
                                                    ) : (
                                                        <span className="text-xl text-neutral-600">♫</span>
                                                    )}
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="truncate font-semibold">
                                                        {isCurrent ? "🎧 " : ""}
                                                        {t.title}
                                                    </p>
                                                    <p className="truncate text-sm text-neutral-400">
                                                        {t.artist || "Неизвестный исполнитель"} ·{" "}
                                                        {profiles[t.owner_id]?.username ?? "Друг"}
                                                    </p>
                                                </div>
                                            </div>
                                            {/* ---------------------------------- */}

                                            <div className="flex shrink-0 gap-2">
                                                <button
                                                    onClick={() => playFriendTracks(i)}
                                                    className="rounded-xl bg-purple-600 px-4 py-2 text-sm font-semibold hover:bg-purple-500"
                                                >
                                                    ▶
                                                </button>
                                                <button
                                                    onClick={() => addToQueue(toPlayerTrack(t as any, userId))}
                                                    disabled={queued}
                                                    className="rounded-xl border border-white/10 px-4 py-2 text-sm hover:bg-neutral-800 disabled:opacity-50"
                                                >
                                                    {queued ? "✓" : "＋"}
                                                </button>
                                            </div>
                                        </div>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </section>
            </div>
        </main>
    );
}