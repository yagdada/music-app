"use client";

import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useState,
} from "react";
import { createClient } from "@/lib/supabase/client";

export type PlayerTrack = {
    id: string;
    title: string;
    artist: string | null;
    file_path: string;
    cover_url?: string | null;
    owner_name?: string;
};

type PlayerContextValue = {
    current: PlayerTrack | null;
    isQueued: (id: string) => boolean;
    playQueue: (tracks: PlayerTrack[], startIndex?: number) => void;
    addToQueue: (track: PlayerTrack) => void;
};

const PlayerContext = createContext<PlayerContextValue | null>(null);

export function usePlayer() {
    const ctx = useContext(PlayerContext);
    if (!ctx) {
        throw new Error("usePlayer нужно использовать внутри PlayerProvider");
    }
    return ctx;
}

export function PlayerProvider({ children }: { children: React.ReactNode }) {
    const supabase = useMemo(() => createClient(), []);

    const [queue, setQueue] = useState<PlayerTrack[]>([]);
    const [index, setIndex] = useState(0);
    const [signed, setSigned] = useState<{ path: string; url: string } | null>(
        null
    );
    const [failedPath, setFailedPath] = useState<string | null>(null);
    const [showQueue, setShowQueue] = useState(false);

    const current = queue[index] ?? null;
    const currentPath = current?.file_path ?? null;

    const url = signed && signed.path === currentPath ? signed.url : null;
    const hasError = failedPath !== null && failedPath === currentPath;

    useEffect(() => {
        if (!currentPath) return;

        let cancelled = false;

        supabase.storage
            .from("tracks")
            .createSignedUrl(currentPath, 3600)
            .then(({ data, error }) => {
                if (cancelled) return;

                if (error || !data) {
                    setFailedPath(currentPath);
                    return;
                }

                setSigned({ path: currentPath, url: data.signedUrl });
            });

        return () => {
            cancelled = true;
        };
    }, [currentPath, supabase]);

    const playQueue = useCallback((tracks: PlayerTrack[], startIndex = 0) => {
        if (tracks.length === 0) return;
        setQueue(tracks);
        setIndex(startIndex);
    }, []);

    const addToQueue = useCallback((track: PlayerTrack) => {
        setQueue((prev) =>
            prev.some((t) => t.id === track.id) ? prev : [...prev, track]
        );
    }, []);

    const isQueued = useCallback(
        (id: string) => queue.some((t) => t.id === id),
        [queue]
    );

    function removeAt(i: number) {
        setQueue((prev) => prev.filter((_, n) => n !== i));
        setIndex((prev) => (i < prev ? prev - 1 : prev));
    }

    function clearQueue() {
        setQueue([]);
        setIndex(0);
        setShowQueue(false);
    }

    function handleEnded() {
        setIndex((i) => (i + 1 < queue.length ? i + 1 : i));
    }

    const value = useMemo(
        () => ({ current, isQueued, playQueue, addToQueue }),
        [current, isQueued, playQueue, addToQueue]
    );

    return (
        <PlayerContext.Provider value={value}>
            {children}

            {current && (
                <div className="fixed bottom-16 left-0 right-0 z-50 border-t border-white/10 bg-neutral-900/95 text-white backdrop-blur md:bottom-0 md:left-64">
                    {showQueue && (
                        <div className="mx-auto max-h-48 md:max-h-64 max-w-2xl overflow-y-auto border-b border-white/10 p-3">
                            <div className="mb-2 flex items-center justify-between">
                                <p className="text-sm font-semibold">
                                    Очередь ({queue.length})
                                </p>
                                <button
                                    onClick={clearQueue}
                                    className="text-xs text-red-400 hover:text-red-300"
                                >
                                    Очистить
                                </button>
                            </div>

                            <ul className="space-y-1">
                                {queue.map((t, i) => (
                                    <li
                                        key={t.id}
                                        className={`flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm ${
                                            i === index ? "bg-purple-600/30" : "hover:bg-neutral-800"
                                        }`}
                                    >
                                        <button
                                            onClick={() => setIndex(i)}
                                            className="min-w-0 flex-1 truncate text-left"
                                        >
                                            {i === index ? "▶ " : `${i + 1}. `}
                                            {t.title}
                                            <span className="text-neutral-400">
                                                {" "}
                                                · {t.artist || "Неизвестный исполнитель"}
                                            </span>
                                        </button>

                                        {i !== index && (
                                            <button
                                                onClick={() => removeAt(i)}
                                                aria-label="Убрать из очереди"
                                                className="text-neutral-400 hover:text-white"
                                            >
                                                ✕
                                            </button>
                                        )}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    <div className="mx-auto flex max-w-2xl items-center gap-4 p-3">
                        {/* Обложка в плеере */}
                        <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-neutral-800 flex items-center justify-center border border-white/10">
                            {current.cover_url ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={current.cover_url} alt="cover" className="h-full w-full object-cover" />
                            ) : (
                                <span className="text-2xl text-neutral-600">♫</span>
                            )}
                        </div>

                        <div className="min-w-0 flex-1">
                            <div className="mb-2 flex items-center justify-between gap-3">
                                <div className="min-w-0">
                                    <p className="truncate text-sm font-semibold">
                                        {current.title}
                                    </p>
                                    <p className="truncate text-xs text-neutral-400">
                                        {current.artist || "Неизвестный исполнитель"}
                                        {current.owner_name ? ` · ${current.owner_name}` : ""}
                                    </p>
                                </div>

                                <div className="flex shrink-0 items-center gap-1">
                                    <button
                                        onClick={() => setIndex((i) => Math.max(0, i - 1))}
                                        disabled={index === 0}
                                        aria-label="Предыдущая"
                                        className="rounded-lg px-3 py-1.5 hover:bg-neutral-800 disabled:opacity-30"
                                    >
                                        ⏮
                                    </button>
                                    <button
                                        onClick={handleEnded}
                                        disabled={index >= queue.length - 1}
                                        aria-label="Следующая"
                                        className="rounded-lg px-3 py-1.5 hover:bg-neutral-800 disabled:opacity-30"
                                    >
                                        ⏭
                                    </button>
                                    <button
                                        onClick={() => setShowQueue((s) => !s)}
                                        className="rounded-lg border border-white/10 px-3 py-1.5 text-sm hover:bg-neutral-800"
                                    >
                                        ☰ {queue.length}
                                    </button>
                                </div>
                            </div>

                            {hasError ? (
                                <p className="text-sm text-red-400">
                                    Не удалось загрузить песню.
                                </p>
                            ) : url ? (
                                <audio
                                    key={current.id}
                                    controls
                                    autoPlay
                                    src={url}
                                    onEnded={handleEnded}
                                    className="w-full h-10"
                                />
                            ) : (
                                <p className="text-sm text-neutral-400">Загружаем...</p>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </PlayerContext.Provider>
    );
}