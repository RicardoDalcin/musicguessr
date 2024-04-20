"use client";

import { useEffect, useState } from "react";
import { Socket, io } from "socket.io-client";

let connected = false;

let socket: Socket | null = null;

export default function Lobby({ params }: { params: { id: string } }) {
  const [players, setPlayers] = useState<string[]>(["Me"]);

  useEffect(() => {
    if (connected) {
      return;
    }

    connected = true;
    socket = io(document.location.origin, {
      query: {
        lobbyId: params.id,
      },
    });

    socket.on("newPlayer", (data: { name: string }) => {
      setPlayers((players) => [...players, data.name]);
    });

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function test() {
    socket?.emit("test", "Hello friend");
  }

  return (
    <main className="flex flex-col items-center justify-between gap-8 px-8 py-24 md:p-24 min-h-screen bg-neutral-200 text-black">
      <div className="flex flex-col gap-8">Lobby: {params.id}</div>

      <button onClick={test}>Test</button>
    </main>
  );
}
