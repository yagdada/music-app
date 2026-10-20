"use client";

interface HeaderProps {
    title: string;
    subtitle?: string;
}

export default function Header({ title, subtitle }: HeaderProps) {
    return (
        <header className="mb-10">
            <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
                {title}
            </h1>

            {subtitle && (
                <p className="mt-3 text-lg text-muted">{subtitle}</p>
            )}
        </header>
    );
}