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
                <div className="min-w-0">
                    <p className="truncate font-semibold">
                        {isCurrent ? "🎧 " : ""}
                        {track.title}
                    </p>
                    <p className="truncate text-sm text-neutral-400">
                        {track.artist || "Неизвестный исполнитель"}
                    </p>
                    <p className="mt-1 truncate text-xs text-neutral-500">
                        {mine ? "Ты" : track.profiles?.username ?? "Друг"} · {date}
                        {mine && track.visibility === "private" ? " · 🔒 только ты" : ""}
                    </p>
                </div>

                <div className="flex shrink-0 gap-2">
                    {!mine && onToggleLike && (
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