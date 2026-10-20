"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function useLikes(userId: string | null) {
    const supabase = useMemo(() => createClient(), []);
    const [likedIds, setLikedIds] = useState<Set<string>>(new Set());
    const [ready, setReady] = useState(false);
    const [likeError, setLikeError] = useState("");

    useEffect(() => {
        if (!userId) return;

        let cancelled = false;

        supabase
            .from("track_likes")
            .select("track_id")
            .eq("user_id", userId)
            .then(({ data, error }) => {
                if (cancelled) return;

                if (error) {
                    setLikeError(`Ошибка загрузки лайков: ${error.message}`);
                } else {
                    setLikedIds(new Set((data ?? []).map((r) => r.track_id as string)));
                }

                setReady(true);
            });

        return () => {
            cancelled = true;
        };
    }, [userId, supabase]);

    const toggleLike = useCallback(
        async (trackId: string) => {
            if (!userId) return;

            const wasLiked = likedIds.has(trackId);
            setLikeError("");

            // Сразу меняем сердечко, не дожидаясь ответа базы
            setLikedIds((prev) => {
                const next = new Set(prev);
                if (wasLiked) next.delete(trackId);
                else next.add(trackId);
                return next;
            });

            const { error } = wasLiked
                ? await supabase
                    .from("track_likes")
                    .delete()
                    .eq("user_id", userId)
                    .eq("track_id", trackId)
                : await supabase
                    .from("track_likes")
                    .insert({ user_id: userId, track_id: trackId });

            if (error) {
                // Откатываем, если не получилось
                setLikedIds((prev) => {
                    const next = new Set(prev);
                    if (wasLiked) next.add(trackId);
                    else next.delete(trackId);
                    return next;
                });
                setLikeError(`Не удалось изменить лайк: ${error.message}`);
            }
        },
        [likedIds, supabase, userId]
    );

    return { likedIds, ready, likeError, toggleLike };
}