"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
    const supabase = createClient();

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [username, setUsername] = useState("");
    const [isRegister, setIsRegister] = useState(false);
    const [message, setMessage] = useState("");
    const [loading, setLoading] = useState(false);

    async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setMessage("");
        setLoading(true);

        try {
            if (isRegister) {
                const { data, error } = await supabase.auth.signUp({
                    email,
                    password,
                    options: {
                        data: {
                            username,
                        },
                    },
                });

                if (error) throw error;

                if (data.session) {
                    window.location.href = "/profile";
                } else {
                    setMessage(
                        "Аккаунт создан! Проверь почту и подтверди регистрацию, если это требуется."
                    );
                }
            } else {
                const { error } = await supabase.auth.signInWithPassword({
                    email,
                    password,
                });

                if (error) throw error;

                window.location.href = "/profile";
            }
        } catch (error) {
            setMessage(
                error instanceof Error
                    ? error.message
                    : "Не удалось выполнить операцию."
            );
        } finally {
            setLoading(false);
        }
    }

    return (
        <main className="flex min-h-screen items-center justify-center bg-neutral-950 px-5 py-10 text-white">
            <section className="w-full max-w-md rounded-3xl border border-white/10 bg-neutral-900 p-8 shadow-2xl sm:p-10">
                <a
                    href="/"
                    className="text-sm text-neutral-400 transition hover:text-white"
                >
                    ← На главную
                </a>

                <div className="mb-8 mt-8 text-center">
                    <div className="mb-4 text-5xl">🎵</div>

                    <h1 className="text-3xl font-bold tracking-tight">
                        MusicApp
                    </h1>

                    <p className="mt-3 text-neutral-400">
                        {isRegister
                            ? "Создай аккаунт и делись музыкой с друзьями"
                            : "Войди в свой музыкальный мир"}
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5">
                    {isRegister && (
                        <div>
                            <label
                                htmlFor="username"
                                className="mb-2 block text-sm font-medium"
                            >
                                Имя пользователя
                            </label>

                            <input
                                id="username"
                                type="text"
                                autoComplete="nickname"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                placeholder="Как тебя называть?"
                                required
                                maxLength={30}
                                className="w-full rounded-xl border border-white/10 bg-neutral-800 px-4 py-3 outline-none transition focus:border-purple-500"
                            />
                        </div>
                    )}

                    <div>
                        <label
                            htmlFor="email"
                            className="mb-2 block text-sm font-medium"
                        >
                            Электронная почта
                        </label>

                        <input
                            id="email"
                            type="email"
                            autoComplete="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="you@example.com"
                            required
                            className="w-full rounded-xl border border-white/10 bg-neutral-800 px-4 py-3 outline-none transition focus:border-purple-500"
                        />
                    </div>

                    <div>
                        <label
                            htmlFor="password"
                            className="mb-2 block text-sm font-medium"
                        >
                            Пароль
                        </label>

                        <input
                            id="password"
                            type="password"
                            autoComplete={
                                isRegister ? "new-password" : "current-password"
                            }
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Не менее 8 символов"
                            minLength={8}
                            required
                            className="w-full rounded-xl border border-white/10 bg-neutral-800 px-4 py-3 outline-none transition focus:border-purple-500"
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full rounded-xl bg-purple-600 px-4 py-3.5 font-semibold transition hover:bg-purple-500 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        {loading
                            ? "Подожди..."
                            : isRegister
                                ? "Создать аккаунт"
                                : "Войти"}
                    </button>
                </form>

                {message && (
                    <p
                        role="status"
                        className="mt-5 rounded-xl bg-neutral-800 p-4 text-sm text-neutral-200"
                    >
                        {message}
                    </p>
                )}

                <div className="mt-6 text-center text-sm text-neutral-400">
                    {isRegister ? "Уже есть аккаунт?" : "Впервые в MusicApp?"}

                    <button
                        type="button"
                        onClick={() => {
                            setIsRegister(!isRegister);
                            setMessage("");
                        }}
                        className="ml-2 font-semibold text-purple-400 hover:text-purple-300"
                    >
                        {isRegister ? "Войти" : "Регистрация"}
                    </button>
                </div>
            </section>
        </main>
    );
}