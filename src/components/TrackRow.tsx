"use client";

import { usePlayer } from "@/components/PlayerProvider";
import { toPlayerTrack, type FeedTrack } from "@/lib/tracks";

export default function TrackRow({
                                     track,
                                     myId,
                                     onPlay,
                                     liked = false,
                                     onToggleLike,
                                 }: {
    track: FeedTrack;
    myId: string | null;
    onPlay: () => void;
    liked?: boolean;
    onToggleLike?: () => void;
}) {
    const { addToQueue, isQueued, current } = usePlayer();

    const mine = track.owner_id === myId;
    const isCurrent = current?.id === track.id;
    const queued = isQueued(track.id);

    const date = new Date(track.created_at).toLocaleDateString("ru-RU", {
        day: "numeric",
        month: "long",
    });

    return (
        <li
            className={`rounded-2xl border bg-neutral-900 p-4 ${
                isCurrent ? "border-purple-500/60" : "border-white/10"
            }`}
        >
            <div className="flex items-center justify-between gap-3">
                {/* --- НАЧАЛО БЛОКА С ОБЛОЖКОЙ --- */}
                <div className="flex min-w-0 items-center gap-3">
                    <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-neutral-800 flex items-center justify-center border border-white/5">
                        {track.cover_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={track.cover_url} alt="cover" className="h-full w-full object-cover" />
                        ) : (
                            <span className="text-xl text-neutral-600">♫</span>
                        )}
                    </div>

                    <div className="min-w-0">
                        <p className="truncate font-semibold">
                            {isCurrent ? "🎧 " : ""}
                            {track.title}
                        </p>
                        <p className="truncate text-sm text-neutral-400">
                            {track.artist || "Неизвестный исполнитель"}
                        </p>
                        <p className="mt-1 truncate text-xs text-neutral-500">
                            {mine ? (
                                "Ты"
                            ) : (
                                <a href={`/profile/${track.owner_id}`} className="hover:text-purple-400 underline decoration-white/20 transition">
                                    {track.profiles?.username ?? "Друг"}
                                </a>
                            )} · {date}
                            {mine && track.visibility === "private" ? " · 🔒 только ты" : ""}
                        </p>
                    </div>
                </div>
                {/* --- КОНЕЦ БЛОКА С ОБЛОЖКОЙ --- */}

                <div className="flex shrink-0 gap-2">
                    {onToggleLike && (
                        <button
                            onClick={onToggleLike}
                            aria-label={liked ? "Убрать лайк" : "Лайкнуть"}
                            className={`rounded-xl border border-white/10 px-4 py-2 text-lg leading-none hover:bg-neutral-800 ${
                                liked ? "text-red-500" : "text-neutral-400"
                            }`}
                        >
                            {liked ? "♥" : "♡"}
                        </button>
                    )}

                    <button
                        onClick={onPlay}
                        aria-label="Слушать"
                        className="rounded-xl bg-purple-600 px-4 py-2 text-sm font-semibold hover:bg-purple-500"
                    >
                        ▶
                    </button>

                    <button
                        onClick={() => addToQueue(toPlayerTrack(track, myId))}
                        disabled={queued}
                        aria-label="Добавить в очередь"
                        className="rounded-xl border border-white/10 px-4 py-2 text-sm hover:bg-neutral-800 disabled:opacity-50"
                    >
                        {queued ? "✓" : "＋"}
                    </button>
                </div>
            </div>
        </li>
    );
}