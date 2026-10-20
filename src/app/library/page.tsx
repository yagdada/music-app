"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { usePlayer } from "@/components/PlayerProvider";
import TrackRow from "@/components/TrackRow";
import { useLikes } from "@/lib/useLikes";
import { TRACK_SELECT, toPlayerTrack, type FeedTrack } from "@/lib/tracks";

type Visibility = "private" | "friends";
type Tab = "uploaded" | "liked";

const MAX_SIZE = 50 * 1024 * 1024; // 50 МБ

export default function LibraryPage() {
    const supabase = createClient();
    const { playQueue, addToQueue, isQueued, current } = usePlayer();

    const [userId, setUserId] = useState<string | null>(null);
    const { likedIds, ready: likesReady, likeError, toggleLike } =
        useLikes(userId);

    const [tab, setTab] = useState<Tab>("uploaded");
    const [uploaded, setUploaded] = useState<FeedTrack[]>([]);
    const [liked, setLiked] = useState<FeedTrack[]>([]);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [message, setMessage] = useState("");

    const [title, setTitle] = useState("");
    const [artist, setArtist] = useState("");
    const [visibility, setVisibility] = useState<Visibility>("private");
    const [file, setFile] = useState<File | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

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
            await Promise.all([loadUploaded(user.id), loadLiked(user.id)]);
            setLoading(false);
        }

        void init();
    }, []);

    async function loadUploaded(uid: string) {
        const { data, error } = await supabase
            .from("tracks")
            .select(TRACK_SELECT)
            .eq("owner_id", uid)
            .order("created_at", { ascending: false });

        if (error) {
            setMessage(`Ошибка загрузки треков: ${error.message}`);
            return;
        }

        setUploaded((data ?? []) as unknown as FeedTrack[]);
    }

    async function loadLiked(uid: string) {
        const { data, error } = await supabase
            .from("track_likes")
            .select(`created_at, tracks(${TRACK_SELECT})`)
            .eq("user_id", uid)
            .order("created_at", { ascending: false });

        if (error) {
            setMessage(`Ошибка загрузки лайков: ${error.message}`);
            return;
        }

        const rows = (data ?? []) as unknown as { tracks: FeedTrack | null }[];

        // Если доступ к песне закрыли, база вернёт null — такие пропускаем
        setLiked(rows.map((r) => r.tracks).filter((t): t is FeedTrack => !!t));
    }

    // Убрал лайк — песня сразу пропадает из вкладки
    const likedVisible = liked.filter((t) => likedIds.has(t.id));

    function onFileChange(event: React.ChangeEvent<HTMLInputElement>) {
        const selected = event.target.files?.[0] ?? null;
        setMessage("");

        if (!selected) {
            setFile(null);
            return;
        }

        if (!selected.type.startsWith("audio/")) {
            setMessage("Выбери аудиофайл (MP3, M4A, WAV, OGG).");
            setFile(null);
            return;
        }

        if (selected.size > MAX_SIZE) {
            setMessage("Файл слишком большой. Максимум — 50 МБ.");
            setFile(null);
            return;
        }

        setFile(selected);

        if (!title.trim()) {
            setTitle(selected.name.replace(/\.[^/.]+$/, ""));
        }
    }

    async function uploadTrack(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (!file || !userId) return;

        const cleanTitle = title.trim();
        if (!cleanTitle) {
            setMessage("Введи название песни.");
            return;
        }

        setUploading(true);
        setMessage("");

        const extension = file.name.split(".").pop()?.toLowerCase() || "mp3";
        const filePath = `${userId}/${crypto.randomUUID()}.${extension}`;

        const { error: uploadError } = await supabase.storage
            .from("tracks")
            .upload(filePath, file, { contentType: file.type });

        if (uploadError) {
            setMessage(`Не удалось загрузить файл: ${uploadError.message}`);
            setUploading(false);
            return;
        }

        const { error: insertError } = await supabase.from("tracks").insert({
            title: cleanTitle,
            artist: artist.trim() || null,
            file_path: filePath,
            visibility,
        });

        if (insertError) {
            await supabase.storage.from("tracks").remove([filePath]);
            setMessage(`Не удалось сохранить трек: ${insertError.message}`);
            setUploading(false);
            return;
        }

        setTitle("");
        setArtist("");
        setVisibility("private");
        setFile(null);
        if (fileInputRef.current) fileInputRef.current.value = "";

        await loadUploaded(userId);
        setMessage("Песня загружена! 🎵");
        setUploading(false);
    }

    async function toggleVisibility(track: FeedTrack) {
        const next: Visibility =
            track.visibility === "private" ? "friends" : "private";

        const { error } = await supabase
            .from("tracks")
            .update({ visibility: next })
            .eq("id", track.id);

        if (error) {
            setMessage(`Не удалось изменить доступ: ${error.message}`);
            return;
        }

        setUploaded((prev) =>
            prev.map((t) => (t.id === track.id ? { ...t, visibility: next } : t))
        );
    }

    async function deleteTrack(track: FeedTrack) {
        if (!window.confirm(`Удалить «${track.title}»?`)) return;

        const { error } = await supabase
            .from("tracks")
            .delete()
            .eq("id", track.id);

        if (error) {
            setMessage(`Не удалось удалить: ${error.message}`);
            return;
        }

        await supabase.storage.from("tracks").remove([track.file_path]);
        setUploaded((prev) => prev.filter((t) => t.id !== track.id));
    }

    function playUploaded(startIndex: number) {
        playQueue(
            uploaded.map((t) => toPlayerTrack(t, userId)),
            startIndex
        );
    }

    function playLiked(startIndex: number) {
        playQueue(
            likedVisible.map((t) => toPlayerTrack(t, userId)),
            startIndex
        );
    }

    if (loading) {
        return (
            <div className="flex min-h-[50vh] items-center justify-center text-white">
                Загружаем библиотеку...
            </div>
        );
    }

    const tabClass = (active: boolean) =>
        `rounded-xl px-4 py-2 text-sm font-semibold transition ${
            active
                ? "bg-purple-600 text-white"
                : "border border-white/10 text-neutral-400 hover:bg-neutral-800"
        }`;

    return (
        <div className="mx-auto max-w-2xl text-white">
            <h1 className="text-3xl font-bold">Моя музыка</h1>
            <p className="mt-1 text-neutral-400">
                Твои загрузки и песни, которые ты лайкнул.
            </p>

            <div className="mt-6 flex gap-2">
                <button
                    onClick={() => setTab("uploaded")}
                    className={tabClass(tab === "uploaded")}
                >
                    Загружено мной ({uploaded.length})
                </button>
                <button
                    onClick={() => setTab("liked")}
                    className={tabClass(tab === "liked")}
                >
                    ♥ Понравилось ({likesReady ? likedVisible.length : "…"})
                </button>
            </div>

            {(message || likeError) && (
                <p role="status" className="mt-4 text-sm text-neutral-300">
                    {message || likeError}
                </p>
            )}

            {tab === "uploaded" && (
                <>
                    <section className="mt-6 rounded-3xl border border-white/10 bg-neutral-900 p-6">
                        <h2 className="text-lg font-bold">Загрузить песню</h2>

                        <form onSubmit={uploadTrack} className="mt-4 space-y-4">
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="audio/*"
                                onChange={onFileChange}
                                className="block w-full text-sm text-neutral-300 file:mr-4 file:rounded-xl file:border-0 file:bg-purple-600 file:px-4 file:py-2 file:font-semibold file:text-white hover:file:bg-purple-500"
                            />

                            <input
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                placeholder="Название песни"
                                maxLength={100}
                                required
                                className="w-full rounded-xl border border-white/10 bg-neutral-800 px-4 py-3 outline-none focus:border-purple-500"
                            />

                            <input
                                value={artist}
                                onChange={(e) => setArtist(e.target.value)}
                                placeholder="Исполнитель (необязательно)"
                                maxLength={100}
                                className="w-full rounded-xl border border-white/10 bg-neutral-800 px-4 py-3 outline-none focus:border-purple-500"
                            />

                            <select
                                value={visibility}
                                onChange={(e) => setVisibility(e.target.value as Visibility)}
                                className="w-full rounded-xl border border-white/10 bg-neutral-800 px-4 py-3 outline-none focus:border-purple-500"
                            >
                                <option value="private">🔒 Только я</option>
                                <option value="friends">👥 Друзья</option>
                            </select>

                            <button
                                type="submit"
                                disabled={uploading || !file}
                                className="w-full rounded-xl bg-purple-600 px-4 py-3 font-semibold hover:bg-purple-500 disabled:opacity-50"
                            >
                                {uploading ? "Загружаем..." : "Загрузить песню"}
                            </button>
                        </form>
                    </section>

                    <ul className="mt-6 space-y-3">
                        {uploaded.length === 0 && (
                            <p className="text-center text-neutral-500">
                                Пока нет песен. Загрузи первую! 🎧
                            </p>
                        )}

                        {uploaded.map((track, i) => {
                            const isCurrent = current?.id === track.id;
                            const queued = isQueued(track.id);

                            return (
                                <li
                                    key={track.id}
                                    className={`rounded-2xl border bg-neutral-900 p-4 ${
                                        isCurrent ? "border-purple-500/60" : "border-white/10"
                                    }`}
                                >
                                    <div className="flex items-center justify-between gap-3">
                                        <div className="min-w-0">
                                            <p className="truncate font-semibold">
                                                {isCurrent ? "🎧 " : ""}
                                                {track.title}
                                            </p>
                                            <p className="truncate text-sm text-neutral-400">
                                                {track.artist || "Неизвестный исполнитель"}
                                            </p>
                                        </div>

                                        <div className="flex shrink-0 gap-2">
                                            <button
                                                onClick={() => playUploaded(i)}
                                                aria-label="Слушать"
                                                className="rounded-xl bg-purple-600 px-4 py-2 text-sm font-semibold hover:bg-purple-500"
                                            >
                                                ▶
                                            </button>
                                            <button
                                                onClick={() =>
                                                    addToQueue(toPlayerTrack(track, userId))
                                                }
                                                disabled={queued}
                                                aria-label="Добавить в очередь"
                                                className="rounded-xl border border-white/10 px-4 py-2 text-sm hover:bg-neutral-800 disabled:opacity-50"
                                            >
                                                {queued ? "✓" : "＋"}
                                            </button>
                                        </div>
                                    </div>

                                    <div className="mt-3 flex items-center justify-between text-sm">
                                        <button
                                            onClick={() => toggleVisibility(track)}
                                            className="rounded-lg border border-white/10 px-3 py-1 hover:bg-neutral-800"
                                        >
                                            {track.visibility === "private"
                                                ? "🔒 Только я"
                                                : "👥 Друзья"}
                                        </button>

                                        <button
                                            onClick={() => deleteTrack(track)}
                                            className="text-red-400 hover:text-red-300"
                                        >
                                            Удалить
                                        </button>
                                    </div>
                                </li>
                            );
                        })}
                    </ul>
                </>
            )}

            {tab === "liked" && (
                <>
                    {likedVisible.length > 0 && (
                        <div className="mt-6 flex justify-end">
                            <button
                                onClick={() => playLiked(0)}
                                className="rounded-xl bg-purple-600 px-4 py-2 text-sm font-semibold hover:bg-purple-500"
                            >
                                ▶ Играть всё
                            </button>
                        </div>
                    )}

                    {!likesReady ? (
                        <p className="mt-10 text-center text-neutral-500">Загружаем...</p>
                    ) : likedVisible.length === 0 ? (
                        <p className="mt-10 text-center text-neutral-500">
                            Пока нет лайкнутых песен. Нажми ♡ в ленте или поиске 🎧
                        </p>
                    ) : (
                        <ul className="mt-4 space-y-3">
                            {likedVisible.map((track, i) => (
                                <TrackRow
                                    key={track.id}
                                    track={track}
                                    myId={userId}
                                    onPlay={() => playLiked(i)}
                                    liked
                                    onToggleLike={() => toggleLike(track.id)}
                                />
                            ))}
                        </ul>
                    )}
                </>
            )}
        </div>
    );
}