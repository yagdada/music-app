import { NextResponse } from "next/server";

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const title = searchParams.get("title");
    const artist = searchParams.get("artist");
    const duration = searchParams.get("duration");

    if (!title) {
        return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }

    try {
        // Формируем запрос к LRCLIB (добавляем duration, если есть, для точности)
        const query = new URLSearchParams({
            track_name: title,
            artist_name: artist || "",
        });
        if (duration) query.append("duration", duration);

        const res = await fetch(`https://lrclib.net/api/get?${query.toString()}`, {
            headers: { "Lrclib-Client": "MusicApp v1.0" } // Честно представляемся
        });

        if (!res.ok) {
            // Если 404 — значит трек не найден
            if (res.status === 404) return NextResponse.json({ syncedLyrics: null });
            throw new Error(`LRCLIB returned ${res.status}`);
        }

        const data = await res.json();

        return NextResponse.json({
            syncedLyrics: data.syncedLyrics || null, // Текст с таймкодами
            plainLyrics: data.plainLyrics || null    // Обычный текст (если нет синхронизации)
        });
    } catch (error) {
        console.error("LRCLIB fetch error:", error);
        return NextResponse.json({ error: "Failed to fetch lyrics" }, { status: 500 });
    }
}