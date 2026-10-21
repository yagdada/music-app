"use client";

import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
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
    const audioRef = useRef<HTMLAudioElement>(null);

    const [queue, setQueue] = useState<PlayerTrack[]>([]);
    const [index, setIndex] = useState(0);
    const [signed, setSigned] = useState<{ path: string; url: string } | null>(
        null
    );
    const [failedPath, setFailedPath] = useState<string | null>(null);
    const [showQueue, setShowQueue] = useState(false);
    const [isPlaying, setIsPlaying] = useState(false);
    const [expanded, setExpanded] = useState(false);
    const [isShuffled, setIsShuffled] = useState(false);

    const current = queue[index] ?? null;
    const currentPath = current?.file_path ?? null;

    const url = signed && signed.path === currentPath ? signed.url : null;
    const hasError = failedPath !== null && failedPath === currentPath;

    // 1. Получаем ссылку на аудио
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

    // 2. Синхронизация Play/Pause. Добавлен url, чтобы play() срабатывал после загрузки ссылки
    useEffect(() => {
        if (audioRef.current) {
            if (isPlaying) {
                audioRef.current.play().catch(() => setIsPlaying(false));
            } else {
                audioRef.current.pause();
            }
        }
    }, [isPlaying, current?.id, url]);

    const playQueue = useCallback((tracks: PlayerTrack[], startIndex = 0) => {
        if (tracks.length === 0) return;
        setQueue(tracks);
        setIndex(startIndex);
        setIsPlaying(true);
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
        setIsPlaying(false);
    }

    function handleEnded() {
        setIndex((i) => (i + 1 < queue.length ? i + 1 : i));
    }

    function togglePlay() {
        setIsPlaying((prev) => !prev);
    }

    function toggleShuffle() {
        if (!isShuffled) {
            const shuffled = [...queue];
            for (let i = shuffled.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
            }
            setQueue(shuffled);
            if (current) {
                const newIndex = shuffled.findIndex((t) => t.id === current.id);
                setIndex(newIndex >= 0 ? newIndex : 0);
            }
        }
        setIsShuffled(!isShuffled);
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
                                            onClick={() => { setIndex(i); setIsPlaying(true); }}
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
                        <div
                            className="h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-neutral-800 flex items-center justify-center border border-white/10 cursor-pointer hover:opacity-80 transition"
                            onClick={() => setExpanded(true)}
                        >
                            {current.cover_url ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={current.cover_url} alt="cover" className="h-full w-full object-cover" />
                            ) : (
                                <span className="text-2xl text-neutral-600">♫</span>
                            )}
                        </div>

                        <div className="min-w-0 flex-1">
                            <div className="mb-2 flex items-center justify-between gap-3">
                                <div className="min-w-0 cursor-pointer" onClick={() => setExpanded(true)}>
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
                                        onClick={toggleShuffle}
                                        aria-label="Перемешать"
                                        className={`rounded-lg px-3 py-1.5 hover:bg-neutral-800 transition ${
                                            isShuffled ? "text-purple-500" : "text-neutral-400"
                                        }`}
                                    >
                                        🔀
                                    </button>
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
                                    <button
                                        onClick={() => setExpanded(true)}
                                        className="hidden sm:block rounded-lg px-3 py-1.5 text-neutral-400 hover:text-white hover:bg-neutral-800"
                                        title="Развернуть"
                                    >
                                        ⛶
                                    </button>
                                </div>
                            </div>

                            {hasError ? (
                                <p className="text-sm text-red-400">
                                    Не удалось загрузить песню.
                                </p>
                            ) : url ? (
                                <>
                                    <audio
                                        ref={audioRef}
                                        key={current.id}
                                        src={url}
                                        onEnded={handleEnded}
                                        onPlay={() => setIsPlaying(true)}
                                        onPause={() => setIsPlaying(false)}
                                        className="hidden"
                                    />

                                    <div className="flex items-center gap-3 mt-1">
                                        <button
                                            onClick={togglePlay}
                                            className="rounded-full bg-purple-600 h-8 w-8 flex items-center justify-center hover:bg-purple-500 transition shrink-0"
                                        >
                                            {isPlaying ? "⏸" : "▶"}
                                        </button>

                                        <div className="flex-1">
                                            <input
                                                type="range"
                                                min="0"
                                                max="100"
                                                defaultValue="0"
                                                onChange={(e) => {
                                                    if (audioRef.current && audioRef.current.duration) {
                                                        audioRef.current.currentTime = (Number(e.target.value) / 100) * audioRef.current.duration;
                                                    }
                                                }}
                                                className="w-full accent-purple-500 h-1 cursor-pointer"
                                            />
                                        </div>
                                    </div>
                                </>
                            ) : (
                                <p className="text-sm text-neutral-400">Загружаем...</p>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {expanded && current && (
                <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-neutral-950/98 p-6 text-white backdrop-blur-2xl">
                    <button
                        onClick={() => setExpanded(false)}
                        className="absolute right-6 top-6 rounded-full bg-neutral-800 p-3 text-neutral-400 hover:bg-neutral-700 hover:text-white transition"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                    </button>

                    <div className="flex w-full max-w-5xl flex-col items-center gap-10 md:flex-row md:items-start md:gap-16">
                        <div className="h-64 w-64 md:h-[400px] md:w-[400px] shrink-0 overflow-hidden rounded-2xl border border-white/10 shadow-2xl">
                            {current.cover_url ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={current.cover_url} alt="cover" className="h-full w-full object-cover" />
                            ) : (
                                <div className="flex h-full w-full items-center justify-center bg-neutral-800 text-8xl text-neutral-600">
                                    ♫
                                </div>
                            )}
                        </div>

                        <div className="flex w-full min-w-0 flex-col items-center md:items-start h-[400px]">
                            <h1 className="text-3xl md:text-5xl font-bold text-center md:text-left truncate w-full">{current.title}</h1>
                            <p className="mt-3 text-lg text-neutral-400 text-center md:text-left truncate w-full">
                                {current.artist || "Неизвестный исполнитель"}
                                {current.owner_name ? ` · ${current.owner_name}` : ""}
                            </p>

                            <div className="mt-8 w-full flex-1 rounded-2xl bg-white/5 p-6 overflow-y-auto border border-white/5 custom-scrollbar">
                                <p className="text-center text-neutral-500 italic mt-20">
                                    Текст песни скоро появится здесь...
                                </p>
                            </div>

                            <div className="mt-6 w-full flex items-center gap-4">
                                <button
                                    onClick={toggleShuffle}
                                    className={`rounded-full p-3 transition ${
                                        isShuffled ? "bg-purple-600/20 text-purple-500" : "text-neutral-400 hover:bg-white/5"
                                    }`}
                                >
                                    🔀
                                </button>

                                <button
                                    onClick={togglePlay}
                                    className="rounded-full bg-purple-600 h-14 w-14 flex items-center justify-center text-xl hover:bg-purple-500 transition shrink-0 shadow-lg shadow-purple-500/20"
                                >
                                    {isPlaying ? "⏸" : "▶"}
                                </button>
                                <input
                                    type="range"
                                    min="0"
                                    max="100"
                                    defaultValue="0"
                                    onChange={(e) => {
                                        if (audioRef.current && audioRef.current.duration) {
                                            audioRef.current.currentTime = (Number(e.target.value) / 100) * audioRef.current.duration;
                                        }
                                    }}
                                    className="w-full accent-purple-500 h-1 cursor-pointer"
                                />
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </PlayerContext.Provider>
    );
}