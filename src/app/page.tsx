import { LobbySetup } from '@/components/LobbySetup';
import { redirect } from 'next/navigation';

interface TriviaQuestion {
  id: string;
  song: string;
  artist: string;
  preview: string;
  guessType: 'artist' | 'song';
  rightAnswerId: string;
  options: {
    id: string;
    name: string;
  }[];
}

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-between px-8 py-24 md:p-24 bg-neutral-200">
      <LobbySetup />
    </main>
  );
}
