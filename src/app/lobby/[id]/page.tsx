'use client';

import { Trivia } from '@/components/Trivia';
import { Player, Playlist } from '@/types';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Socket, io } from 'socket.io-client';

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

let connected = false;

let socket: Socket | null = null;

export default function Lobby({ params }: { params: { id: string } }) {
  const [playlistUrl, setPlaylistUrl] = useState<string>('');
  const [playlist, setPlaylist] = useState<Playlist | null>(null);
  const [trivia, setTrivia] = useState<TriviaQuestion[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [guesses, setGuesses] = useState<
    Map<string, { questionId: string; answerId: string }[]>
  >(new Map());

  const me = useMemo(
    () => players.find((player) => player.id === socket?.id),
    [players]
  );

  const myGuesses = useMemo(
    () => guesses.get(socket?.id ?? '') ?? [],
    [guesses]
  );

  const otherGuesses = useMemo(
    () =>
      Array.from(guesses)
        .filter(([playerId]) => playerId !== socket?.id)
        .flatMap(([playerId, guesses]) =>
          guesses.map((guess) => ({ playerId, ...guess }))
        ),
    [guesses]
  );

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

    socket.on('newPlayer', (data: Player) => {
      console.log('player connected', data);
      setPlayers((players) => [...players, data]);
    });

    socket.on('playerList', (data: Player[]) => {
      setPlayers(data);
    });

    socket.on(
      'playlist',
      ({
        playlist,
        trivia,
      }: {
        playlist: Playlist;
        trivia: TriviaQuestion[];
      }) => {
        setPlaylist(playlist);
        setTrivia(trivia);
      }
    );

    socket.on(
      'guesses',
      (data: [string, { questionId: string; answerId: string }[]][]) => {
        setGuesses(new Map(data));
      }
    );

    socket.on(
      'guess',
      (data: { questionId: string; answerId: string; playerId: string }) => {
        setGuesses((guesses) => {
          const newGuesses = new Map(guesses);

          newGuesses.set(data.playerId, [
            ...(newGuesses.get(data.playerId) ?? []),
            {
              questionId: data.questionId,
              answerId: data.answerId,
            },
          ]);

          console.log(
            `Incoming guess: ${data.playerId} - ${data.questionId} - ${data.answerId}`,
            newGuesses
          );
          return newGuesses;
        });
      }
    );

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function selectPlaylist() {
    if (!socket) {
      return;
    }

    // setIsLoading(true);
    // setError(null);

    const isSpotifyUrl = new RegExp(
      '^(https://open.spotify.com(/intl-.+)?/playlist/).+'
    ).test(playlistUrl);

    const playlistId =
      playlistUrl.split('playlist/').pop()?.split('?')[0] ?? '';

    if (!isSpotifyUrl || !playlistId) {
      // setError(
      //   'A URL inserida não é válida. Por favor, insira uma URL válida.'
      // );
      // setIsLoading(false);
      return;
    }

    socket.emit('setPlaylist', playlistId);
  }

  const onGuess = useCallback((questionId: string, answerId: string) => {
    if (!socket || !socket.id) {
      return;
    }

    console.log(`Guessing ${questionId} - ${answerId}`);

    setGuesses((guesses) => {
      const newGuesses = new Map(guesses);

      if (!socket || !socket.id) {
        return newGuesses;
      }

      newGuesses.set(socket.id, [
        ...(newGuesses.get(socket.id) ?? []),
        {
          questionId,
          answerId,
        },
      ]);

      console.log(newGuesses);
      return newGuesses;
    });

    socket.emit('guess', { questionId, answerId });
  }, []);

  return (
    <main className="flex flex-col items-center justify-between gap-8 px-8 py-24 md:p-24 min-h-screen bg-neutral-200 text-black">
      <div className="flex flex-col gap-8">
        <div className="flex flex-col gap-8">Lobby: {params.id}</div>

        <div className="flex flex-col gap-8">
          Players: {players.map((player) => player.name).join(', ')}
        </div>

        {me && me.isHost && (
          <div className="flex flex-col gap-4">
            <p>Select the playlist:</p>
            <input
              value={playlistUrl}
              onChange={(e) => setPlaylistUrl(e.target.value)}
            />
            <button onClick={selectPlaylist}>Set playlist</button>
          </div>
        )}

        {playlist && (
          <div>
            <img src={playlist.images[0].url} alt={playlist.name} />

            <Trivia
              playlist={playlist}
              myGuesses={myGuesses}
              otherGuesses={otherGuesses}
              onGuess={onGuess}
              trivia={trivia}
            />
          </div>
        )}
      </div>
    </main>
  );
}
