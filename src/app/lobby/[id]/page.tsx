'use client';

export default function Lobby({ params }: { params: { id: string } }) {
  return (
    <main className="flex flex-col items-center justify-between gap-8 px-8 py-24 md:p-24 min-h-screen bg-neutral-200 text-black">
      <div className="flex flex-col gap-8">Lobby: {params.id}</div>
    </main>
  );
}
