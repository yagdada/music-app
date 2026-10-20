import Header from "@/components/Header";

export default function HomePage() {
  return (
    <div>
      <Header
        title="Лента"
        subtitle="Последние треки от тебя и друзей"
      />

      <div className="rounded-xl border border-border bg-card p-8 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-card-hover text-3xl">
          🎵
        </div>
        <h2 className="mb-2 text-lg font-medium">Пока здесь пусто</h2>
        <p className="mx-auto max-w-sm text-sm text-muted">
          Когда появятся первые треки, они будут отображаться здесь в виде ленты.
        </p>
      </div>
    </div>
  );
}
