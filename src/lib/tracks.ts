import type { PlayerTrack } from "@/components/PlayerProvider";

export type FeedTrack = {
    id: string;
    owner_id: string;
    title: string;
    artist: string | null;
    file_path: string;
    cover_url: string | null;
    lyrics: string | null; // Обычный текст
    duration: number | null; // <--- ДОБАВИЛИ длительность
    synced_lyrics: string | null; // <--- ДОБАВИЛИ текст с таймкодами
    visibility: "private" | "friends";
    created_at: string;
    profiles: { username: string; avatar_url: string | null } | null;
};

export const TRACK_SELECT =
    "id, owner_id, title, artist, file_path, cover_url, lyrics, duration, synced_lyrics, visibility, created_at, profiles!owner_id(username, avatar_url)"; // <--- ДОБАВИЛИ новые поля

export function toPlayerTrack(
    track: FeedTrack,
    myId: string | null
): PlayerTrack {
    return {
        id: track.id,
        title: track.title,
        artist: track.artist,
        file_path: track.file_path,
        cover_url: track.cover_url,
        lyrics: track.lyrics,
        duration: track.duration, // <--- ДОБАВИЛИ
        synced_lyrics: track.synced_lyrics, // <--- ДОБАВИЛИ
        owner_name:
            track.owner_id === myId ? "Я" : track.profiles?.username ?? "Друг",
    };
}