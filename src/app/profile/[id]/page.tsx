import { Suspense } from "react";
import ProfileClient from "./ProfileClient";

export default function ProfilePage({ params }: { params: Promise<{ id: string }> }) {
    return (
        <Suspense fallback={<div className="flex min-h-[50vh] items-center justify-center text-white">Загружаем профиль...</div>}>
            <ProfileContent params={params} />
        </Suspense>
    );
}

// Выносим ожидание params в отдельный компонент внутри Suspense
async function ProfileContent({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    return <ProfileClient friendId={id} />;
}