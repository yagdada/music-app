"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { usePlayer } from "@/components/PlayerProvider";
import TrackRow from "@/components/TrackRow";
import { TRACK_SELECT, toPlayerTrack, type FeedTrack } from "@/lib/tracks";
import { useLikes } from "@/lib/useLikes";

export default function SearchPage() {
    const supabase = createClient();
    const { playQueue } = usePlayer();

    const [userId, setUserId] = useState<string | null>(null);
    const { likedIds, toggleLike } = useLikes(userId);
    const [query, setQuery] = useState("");
    const [results, setResults] = useState<FeedTrack[]>([]);
    const [searching, setSearching] = useState(false);
    const [searched, setSearched] = useState(false);
    const [message, setMessage] = useState("");

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
        }

        void init();
    }, []);

    async function search(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();

        const text = query.trim();
        if (text.length < 2) {
            setMessage("Введи минимум 2 символа.");
            return;
        }

        setSearching(true);
        setMessage("");

        // Убираем символы, ломающие фильтр, и экранируем шаблон поиска
        const safe = text
            .replace(/[,()"]/g, " ")
            .trim()
            .replace(/[\\%_]/g, (c) => `\\${c}`);

        const { data, error } = await supabase
            .from("tracks")
            .select(TRACK_SELECT)
            .or(`title.ilike.%${safe}%,artist.ilike.%${safe}%`)
            .order("created_at", { ascending: false })
            .limit(50);

        if (error) {
            setMessage(`Ошибка поиска: ${error.message}`);
            setResults([]);
        } else {
            setResults((data ?? []) as unknown as FeedTrack[]);
        }

        setSearched(true);
        setSearching(false);
    }

    function playFrom(startIndex: number) {
        playQueue(
            results.map((t) => toPlayerTrack(t, userId)),
            startIndex
        );
    }

    return (
        <main className="min-h-screen bg-neutral-950 px-5 py-8 text-white">
            <div className="mx-auto max-w-2xl">
                <h1 className="text-3xl font-bold">Поиск</h1>
                <p className="mt-1 text-neutral-400">
                    Ищи песни друзей по названию или исполнителю.
                </p>

                <form onSubmit={search} className="mt-6 flex gap-2">
                    <input
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Название или исполнитель"
                        maxLength={100}
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

                {searched && results.length === 0 && !message && (
                    <p className="mt-10 text-center text-neutral-500">
                        Ничего не нашли 🔍
                    </p>
                )}

                {results.length > 0 && (
                    <ul className="mt-6 space-y-3">
                        {results.map((track, i) => (
                            <TrackRow
                                key={track.id}
                                track={track}
                                myId={userId}
                                onPlay={() => playFrom(i)}
                                liked={likedIds.has(track.id)}
                                onToggleLike={() => toggleLike(track.id)}
                            />
                        ))}
                    </ul>
                )}
            </div>
        </main>
    );
}