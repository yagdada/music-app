import type { PlayerTrack } from "@/components/PlayerProvider";

export type FeedTrack = {
    id: string;
    owner_id: string;
    title: string;
    artist: string | null;
    file_path: string;
    visibility: "private" | "friends";
    created_at: string;
    profiles: { username: string; avatar_url: string | null } | null;
};

export const TRACK_SELECT =
    "id, owner_id, title, artist, file_path, visibility, created_at, profiles(username, avatar_url)";

export function toPlayerTrack(
    track: FeedTrack,
    myId: string | null
): PlayerTrack {
    return {
        id: track.id,
        title: track.title,
        artist: track.artist,
        file_path: track.file_path,
        owner_name:
            track.owner_id === myId ? "Я" : track.profiles?.username ?? "Друг",
    };
}