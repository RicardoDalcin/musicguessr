'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

export const LobbySetup = () => {
  const [joinLobbyId, setJoinLobbyId] = useState('');

  const router = useRouter();

  const joinLobby = async () => {
    router.push(`/lobby/${joinLobbyId}`);
  };

  const createLobby = async () => {
    const response = await fetch('/api/lobbies', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const lobbyId: string = (await response.json()).lobbyId;
    router.push(`/lobby/${lobbyId}`);
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-between px-8 py-24 md:p-24 bg-neutral-200">
      <div className="flex flex-col items-center gap-4 w-full max-w-[600px]">
        <button
          onClick={createLobby}
          className="rounded-lg bg-indigo-500 text-white px-4 py-2"
        >
          Create Lobby
        </button>

        <input
          value={joinLobbyId}
          onChange={(e) => setJoinLobbyId(e.target.value)}
          placeholder="Enter lobby ID"
          className="rounded-lg px-4 py-2 text-black"
        />
        <button
          onClick={joinLobby}
          className="rounded-lg bg-indigo-500 text-white px-4 py-2"
        >
          Join Lobby
        </button>
      </div>
    </main>
  );
};
