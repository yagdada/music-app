"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { usePlayer } from "@/components/PlayerProvider";
import TrackRow from "@/components/TrackRow";
import { TRACK_SELECT, toPlayerTrack, type FeedTrack } from "@/lib/tracks";
import { useLikes } from "@/lib/useLikes";

export default function FeedPage() {
    const supabase = createClient();
    const { playQueue } = usePlayer();

    const [userId, setUserId] = useState<string | null>(null);
    const { likedIds, toggleLike } = useLikes(userId);
    const [tracks, setTracks] = useState<FeedTrack[]>([]);
    const [loading, setLoading] = useState(true);
    const [message, setMessage] = useState("");

    useEffect(() => {
        async function load() {
            const {
                data: { user },
            } = await supabase.auth.getUser();

            if (!user) {
                window.location.href = "/login";
                return;
            }

            setUserId(user.id);

            // База сама вернёт только твои песни и песни друзей с доступом «Друзья»
            const { data, error } = await supabase
                .from("tracks")
                .select(TRACK_SELECT)
                .order("created_at", { ascending: false })
                .limit(50);

            if (error) {
                setMessage(`Ошибка загрузки ленты: ${error.message}`);
            } else {
                setTracks((data ?? []) as unknown as FeedTrack[]);
            }

            setLoading(false);
        }

        void load();
    }, []);

    function playFrom(startIndex: number) {
        playQueue(
            tracks.map((t) => toPlayerTrack(t, userId)),
            startIndex
        );
    }

    if (loading) {
        return (
            <main className="flex min-h-screen items-center justify-center bg-neutral-950 text-white">
                Загружаем ленту...
            </main>
        );
    }

    return (
        <main className="min-h-screen bg-neutral-950 px-5 py-8 text-white">
            <div className="mx-auto max-w-2xl">
                <div className="flex items-center justify-between gap-3">
                    <div>
                        <h1 className="text-3xl font-bold">Лента</h1>
                        <p className="mt-1 text-neutral-400">
                            Новые песни от тебя и твоих друзей.
                        </p>
                    </div>

                    {tracks.length > 0 && (
                        <button
                            onClick={() => playFrom(0)}
                            className="shrink-0 rounded-xl bg-purple-600 px-4 py-2 text-sm font-semibold hover:bg-purple-500"
                        >
                            ▶ Играть всё
                        </button>
                    )}
                </div>

                {message && (
                    <p role="status" className="mt-4 text-sm text-neutral-300">
                        {message}
                    </p>
                )}

                {tracks.length === 0 && !message ? (
                    <p className="mt-10 text-center text-neutral-500">
                        В ленте пока пусто. Загрузи песню или добавь друзей 🎧
                    </p>
                ) : (
                    <ul className="mt-6 space-y-3">
                        {tracks.map((track, i) => (
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