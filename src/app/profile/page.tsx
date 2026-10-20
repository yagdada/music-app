"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Profile = {
  id: string;
  username: string;
  avatar_url: string | null;
};

const MAX_AVATAR_SIZE = 2 * 1024 * 1024; // 2 МБ
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

export default function ProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const supabase = createClient();

  useEffect(() => {
    async function loadProfile() {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        window.location.href = "/login";
        return;
      }

      const { data, error } = await supabase
          .from("profiles")
          .select("id, username, avatar_url")
          .eq("id", user.id)
          .maybeSingle();

      if (error) {
        setMessage(`Ошибка загрузки профиля: ${error.message}`);
        setLoading(false);
        return;
      }

      let currentProfile = data;

      if (!currentProfile) {
        const newProfile = {
          id: user.id,
          username:
              user.user_metadata?.username?.trim() || "Пользователь",
          avatar_url: null,
        };

        const { data: inserted, error: insertError } = await supabase
            .from("profiles")
            .insert(newProfile)
            .select("id, username, avatar_url")
            .single();

        if (insertError) {
          setMessage(`Ошибка создания профиля: ${insertError.message}`);
          setLoading(false);
          return;
        }

        currentProfile = inserted;
      }

      setProfile(currentProfile);
      setUsername(currentProfile.username);
      setLoading(false);
    }

    void loadProfile();
  }, []);

  async function saveProfile() {
    if (!profile) return;

    const cleanUsername = username.trim();

    if (!cleanUsername) {
      setMessage("Введи имя пользователя.");
      return;
    }

    setSaving(true);
    setMessage("");

    const { data, error } = await supabase
        .from("profiles")
        .update({ username: cleanUsername })
        .eq("id", profile.id)
        .select("id, username, avatar_url")
        .single();

    if (error) {
      setMessage(`Не удалось сохранить изменения: ${error.message}`);
    } else {
      setProfile(data);
      setUsername(data.username);
      setMessage("Имя успешно сохранено!");
    }

    setSaving(false);
  }

  async function uploadAvatar(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file || !profile) return;

    if (!ALLOWED_TYPES.includes(file.type)) {
      setMessage("Выбери изображение в формате JPG, PNG или WebP.");
      return;
    }

    if (file.size > MAX_AVATAR_SIZE) {
      setMessage("Файл слишком большой. Максимум — 2 МБ.");
      return;
    }

    setUploading(true);
    setMessage("");

    const filePath = `${profile.id}/avatar`;

    const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, file, {
          upsert: true,
          contentType: file.type,
          cacheControl: "3600",
        });

    if (uploadError) {
      setMessage(`Не удалось загрузить фото: ${uploadError.message}`);
      setUploading(false);
      return;
    }

    const { data: publicData } = supabase.storage
        .from("avatars")
        .getPublicUrl(filePath);

    // Добавляем метку времени, чтобы браузер сразу показал новое фото
    const avatarUrl = `${publicData.publicUrl}?t=${Date.now()}`;

    const { data, error: updateError } = await supabase
        .from("profiles")
        .update({ avatar_url: avatarUrl })
        .eq("id", profile.id)
        .select("id, username, avatar_url")
        .single();

    if (updateError) {
      setMessage(`Фото загружено, но профиль не обновился: ${updateError.message}`);
    } else {
      setProfile(data);
      setMessage("Фото профиля обновлено!");
    }

    setUploading(false);
  }

  async function logout() {
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  if (loading) {
    return (
        <main className="flex min-h-screen items-center justify-center bg-neutral-950 text-white">
          Загружаем профиль...
        </main>
    );
  }

  return (
      <main className="min-h-screen bg-neutral-950 px-5 py-12 text-white">
        <div className="mx-auto max-w-2xl">
          <header className="mb-10 flex items-center justify-between">
            <a href="/" className="text-xl font-bold">
              🎵 MusicApp
            </a>

            <button
                onClick={logout}
                className="rounded-xl border border-white/10 px-4 py-2 text-sm hover:bg-neutral-800"
            >
              Выйти
            </button>
          </header>

          <section className="rounded-3xl border border-white/10 bg-neutral-900 p-6 sm:p-10">
            <h1 className="text-3xl font-bold">Мой профиль</h1>

            <p className="mt-2 text-neutral-400">
              Управляй своим профилем MusicApp.
            </p>

            <div className="mt-8 flex flex-col items-center gap-4">
              {profile?.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                      src={profile.avatar_url}
                      alt="Аватар пользователя"
                      className="h-28 w-28 rounded-full object-cover"
                  />
              ) : (
                  <div className="flex h-28 w-28 items-center justify-center rounded-full bg-purple-700 text-4xl font-bold">
                    {username.trim().charAt(0).toUpperCase() || "♫"}
                  </div>
              )}

              <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={uploadAvatar}
                  className="hidden"
              />

              <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="rounded-xl border border-white/10 px-4 py-2 text-sm hover:bg-neutral-800 disabled:opacity-50"
              >
                {uploading ? "Загружаем..." : "Изменить фото"}
              </button>

              <p className="text-xs text-neutral-500">
                JPG, PNG или WebP, до 2 МБ
              </p>
            </div>

            <div className="mt-8">
              <label
                  htmlFor="username"
                  className="mb-2 block text-sm font-medium"
              >
                Имя пользователя
              </label>

              <input
                  id="username"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  maxLength={30}
                  className="w-full rounded-xl border border-white/10 bg-neutral-800 px-4 py-3 outline-none focus:border-purple-500"
              />
            </div>

            <button
                onClick={saveProfile}
                disabled={saving || !profile}
                className="mt-5 w-full rounded-xl bg-purple-600 px-4 py-3 font-semibold hover:bg-purple-500 disabled:opacity-50"
            >
              {saving ? "Сохраняем..." : "Сохранить профиль"}
            </button>

            {message && (
                <p role="status" className="mt-4 text-sm text-neutral-300">
                  {message}
                </p>
            )}
          </section>
        </div>
      </main>
  );
}