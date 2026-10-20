"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { usePlayer } from "@/components/PlayerProvider";
import TrackRow from "@/components/TrackRow";
import { useLikes } from "@/lib/useLikes";
import { TRACK_SELECT, toPlayerTrack, type FeedTrack } from "@/lib/tracks";

export default function ProfileClient({ friendId }: { friendId: string }) {
    const supabase = createClient();
    const { playQueue } = usePlayer();

    const [userId, setUserId] = useState<string | null>(null);
    const { likedIds, toggleLike } = useLikes(userId);

    const [profile, setProfile] = useState<{ username: string; avatar_url: string | null } | null>(null);
    const [tracks, setTracks] = useState<FeedTrack[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function init() {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) setUserId(user.id);

            // 1. Загружаем профиль друга
            const { data: profData } = await supabase
                .from("profiles")
                .select("username, avatar_url")
                .eq("id", friendId)
                .single();

            if (profData) setProfile(profData);

            // 2. Загружаем его треки (база сама отдаст только доступные тебе)
            const { data: tracksData } = await supabase
                .from("tracks")
                .select(TRACK_SELECT)
                .eq("owner_id", friendId)
                .order("created_at", { ascending: false });

            if (tracksData) setTracks(tracksData as unknown as FeedTrack[]);

            setLoading(false);
        }
        void init();
    }, [friendId, supabase]);

    if (loading) {
        return <div className="flex min-h-[50vh] items-center justify-center text-white">Загружаем профиль...</div>;
    }

    if (!profile) {
        return <div className="flex min-h-[50vh] items-center justify-center text-white">Пользователь не найден</div>;
    }

    return (
        <div className="mx-auto max-w-2xl text-white">
            <header className="flex items-center gap-6 rounded-3xl border border-white/10 bg-neutral-900 p-8">
                {profile.avatar_url ? (
                    <img src={profile.avatar_url} alt="avatar" className="h-24 w-24 rounded-full object-cover"/>
                ) : (
                    <div className="flex h-24 w-24 items-center justify-center rounded-full bg-purple-700 text-3xl font-bold">
                        {profile.username.charAt(0).toUpperCase()}
                    </div>
                )}
                <div>
                    <h1 className="text-3xl font-bold">{profile.username}</h1>
                    <p className="mt-1 text-neutral-400">Музыка пользователя</p>
                </div>
            </header>

            <div className="mt-8 flex items-center justify-between">
                <h2 className="text-xl font-bold">Треки ({tracks.length})</h2>
                {tracks.length > 0 && (
                    <button
                        onClick={() => playQueue(tracks.map((t) => toPlayerTrack(t, userId)), 0)}
                        className="rounded-xl bg-purple-600 px-4 py-2 text-sm font-semibold hover:bg-purple-500"
                    >
                        ▶ Играть всё
                    </button>
                )}
            </div>

            {tracks.length === 0 ? (
                <p className="mt-6 text-center text-neutral-500">У пользователя пока нет доступных песен.</p>
            ) : (
                <ul className="mt-4 space-y-3">
                    {tracks.map((track, i) => (
                        <TrackRow
                            key={track.id}
                            track={track}
                            myId={userId}
                            onPlay={() => playQueue(tracks.map((t) => toPlayerTrack(t, userId)), i)}
                            liked={likedIds.has(track.id)}
                            onToggleLike={() => toggleLike(track.id)}
                        />
                    ))}
                </ul>
            )}
        </div>
    );
}