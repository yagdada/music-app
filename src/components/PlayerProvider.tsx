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
    lyrics?: string | null;
    duration?: number | null; // <--- ДОБАВИЛИ
    synced_lyrics?: string | null; // <--- ДОБАВИЛИ
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

function formatTime(seconds: number) {
    if (isNaN(seconds) || seconds === Infinity) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
}

// Парсер LRC формата (текст с таймкодами)
function parseLrc(lrc: string) {
    const lines = lrc.split("\n");
    const result: { time: number; text: string }[] = [];

    for (const line of lines) {
        const match = line.match(/\[(\d+):(\d+\.\d+)\](.*)/);
        if (match) {
            const minutes = parseInt(match[1]);
            const seconds = parseFloat(match[2]);
            const text = match[3].trim();
            if (text) {
                result.push({ time: minutes * 60 + seconds, text });
            }
        }
    }
    // Сортируем на всякий случай по времени
    return result.sort((a, b) => a.time - b.time);
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

    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);

    const current = queue[index] ?? null;
    const currentPath = current?.file_path ?? null;

    const url = signed && signed.path === currentPath ? signed.url : null;
    const hasError = failedPath !== null && failedPath === currentPath;

    // Парсим караоке-текст
    const parsedLyrics = useMemo(() => {
        if (!current?.synced_lyrics) return [];
        return parseLrc(current.synced_lyrics);
    }, [current?.synced_lyrics]);

    // Находим текущую активную строчку
    const currentLine = useMemo(() => {
        if (!parsedLyrics.length) return null;
        for (let i = parsedLyrics.length - 1; i >= 0; i--) {
            if (currentTime >= parsedLyrics[i].time) {
                return parsedLyrics[i];
            }
        }
        return parsedLyrics[0];
    }, [parsedLyrics, currentTime]);

    // Индекс следующей строчки для красивого отображения
    const currentLineIndex = currentLine ? parsedLyrics.indexOf(currentLine) : -1;

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

    function handleNext() {
        setIndex((i) => (i + 1 < queue.length ? i + 1 : 0));
        setIsPlaying(true);
    }

    function handlePrev() {
        if (audioRef.current && audioRef.current.currentTime > 3) {
            audioRef.current.currentTime = 0;
            return;
        }
        setIndex((i) => (i - 1 >= 0 ? i - 1 : queue.length - 1));
        setIsPlaying(true);
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

    function handleSeek(e: React.ChangeEvent<HTMLInputElement>) {
        const time = Number(e.target.value);
        setCurrentTime(time);
        if (audioRef.current) {
            audioRef.current.currentTime = time;
        }
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
                                            isShuffled ? "text-purple-500 bg-purple-500/10" : "text-neutral-400"
                                        }`}
                                    >
                                        🔀
                                    </button>
                                    <button
                                        onClick={handlePrev}
                                        aria-label="Предыдущая"
                                        className="rounded-lg px-3 py-1.5 hover:bg-neutral-800"
                                    >
                                        ⏮
                                    </button>
                                    <button
                                        onClick={handleNext}
                                        aria-label="Следующая"
                                        className="rounded-lg px-3 py-1.5 hover:bg-neutral-800"
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
                                        onEnded={handleNext}
                                        onPlay={() => setIsPlaying(true)}
                                        onPause={() => setIsPlaying(false)}
                                        onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
                                        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
                                        className="hidden"
                                    />

                                    <div className="flex items-center gap-3 mt-1">
                                        <span className="text-[10px] text-neutral-400 w-8 text-right tabular-nums">
                                            {formatTime(currentTime)}
                                        </span>
                                        <div className="flex-1">
                                            <input
                                                type="range"
                                                min="0"
                                                max={duration || 100}
                                                value={currentTime}
                                                onChange={handleSeek}
                                                className="w-full accent-purple-500 h-1 cursor-pointer"
                                            />
                                        </div>
                                        <span className="text-[10px] text-neutral-400 w-8 tabular-nums">
                                            {formatTime(duration)}
                                        </span>
                                        <button
                                            onClick={togglePlay}
                                            className="rounded-full bg-purple-600 h-8 w-8 flex items-center justify-center hover:bg-purple-500 transition shrink-0 ml-2"
                                        >
                                            {isPlaying ? "⏸" : "▶"}
                                        </button>
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

                            {/* ВЫВОД ТЕКСТА ПЕСНИ (КАРАОКЕ) */}
                            <div className="mt-8 w-full flex-1 rounded-2xl bg-white/5 p-6 overflow-y-auto border border-white/5 custom-scrollbar flex flex-col justify-center items-center">
                                {parsedLyrics.length > 0 ? (
                                    <div className="text-center transition-all duration-300">
                                        <h2 className="text-2xl md:text-4xl font-bold text-white drop-shadow-md leading-tight">
                                            {currentLine?.text}
                                        </h2>
                                        {currentLineIndex + 1 < parsedLyrics.length && (
                                            <p className="mt-6 text-lg md:text-xl text-neutral-500 leading-tight">
                                                {parsedLyrics[currentLineIndex + 1].text}
                                            </p>
                                        )}
                                    </div>
                                ) : current.lyrics ? (
                                    <pre className="whitespace-pre-wrap font-sans text-neutral-300 text-sm md:text-base leading-relaxed text-center">
                                        {current.lyrics}
                                    </pre>
                                ) : (
                                    <p className="text-center text-neutral-500 italic mt-20">
                                        Текст песни не найден.
                                    </p>
                                )}
                            </div>

                            <div className="mt-6 w-full flex flex-col gap-2">
                                <div className="flex items-center gap-3 w-full">
                                    <span className="text-xs text-neutral-400 tabular-nums w-10 text-right">
                                        {formatTime(currentTime)}
                                    </span>
                                    <input
                                        type="range"
                                        min="0"
                                        max={duration || 100}
                                        value={currentTime}
                                        onChange={handleSeek}
                                        className="w-full accent-purple-500 h-1 cursor-pointer"
                                    />
                                    <span className="text-xs text-neutral-400 tabular-nums w-10">
                                        {formatTime(duration)}
                                    </span>
                                </div>

                                <div className="flex items-center justify-center gap-6 mt-4">
                                    <button
                                        onClick={toggleShuffle}
                                        className={`rounded-full p-3 transition ${
                                            isShuffled ? "bg-purple-600/20 text-purple-500" : "text-neutral-400 hover:text-white"
                                        }`}
                                    >
                                        🔀
                                    </button>

                                    <button
                                        onClick={handlePrev}
                                        className="text-neutral-400 hover:text-white transition"
                                    >
                                        ⏮
                                    </button>

                                    <button
                                        onClick={togglePlay}
                                        className="rounded-full bg-purple-600 h-16 w-16 flex items-center justify-center text-2xl hover:bg-purple-500 transition shrink-0 shadow-lg shadow-purple-500/20"
                                    >
                                        {isPlaying ? "⏸" : "▶"}
                                    </button>

                                    <button
                                        onClick={handleNext}
                                        className="text-neutral-400 hover:text-white transition"
                                    >
                                        ⏭
                                    </button>

                                    <div className="w-12"></div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </PlayerContext.Provider>
    );
}