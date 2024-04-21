import express from 'express';
import next from 'next';
import http from 'http';
import { Server, Socket } from 'socket.io';
import { Player, Playlist, TriviaQuestion } from '@/types';

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();

const players = new Map<string, Player[]>();

const playlist: {
  url: string;
  data: Playlist | null;
  trivia: TriviaQuestion[];
} = { url: '', data: null, trivia: [] };

const guesses = new Map<string, { questionId: string; answerId: string }[]>();

function generateName() {
  return 'Player ' + Math.floor(Math.random() * 1000);
}

function getSongs(playlist: Playlist): TriviaQuestion[] {
  // choose 10 random songs (must have preview_url)
  const songs = playlist.tracks.items
    .map((item) => item.track)
    .filter((track) => track.preview_url)
    .sort(() => Math.random() - 0.5)
    .slice(0, 10);

  // for each song, create object with guess type (artist or song) and options
  return songs.map((song) => {
    const isArtist = Math.random() > 0.5;
    const options = songs
      .map((s) => (isArtist ? s.artists[0].name : s.name))
      .filter((name) => name !== (isArtist ? song.artists[0].name : song.name))
      .sort(() => Math.random() - 0.5)
      .slice(0, 3);

    const questionId = Math.random().toString(36).substring(7);
    const rightAnswerId = isArtist ? song.artists[0].id : song.id;

    return {
      id: questionId,
      song: song.name,
      artist: song.artists[0].name,
      preview: song.preview_url ?? '',
      guessType: isArtist ? 'artist' : ('song' as 'artist' | 'song'),
      rightAnswerId,
      options: [
        ...options.map((option) => ({
          id: Math.random().toString(36).substring(7),
          name: option,
        })),
        {
          id: rightAnswerId,
          name: isArtist ? song.artists[0].name : song.name,
        },
      ].sort(() => Math.random() - 0.5),
    };
  });
}

app.prepare().then(async () => {
  const server = express();
  const httpServer = http.createServer(server);
  const io = new Server(httpServer);

  io.on('connection', (socket) => {
    const lobbyId = (socket.handshake.query.lobbyId ?? '') as string;
    console.log('Client connected');

    socket.join(lobbyId ?? '');

    const currentPlayers = players.get(lobbyId) ?? [];

    const newPlayer: Player = {
      id: socket.id,
      name: generateName(),
      isHost: currentPlayers.length === 0,
    };

    const newList = [...currentPlayers, newPlayer];

    // Inform the new player about the other players
    socket.emit('playerList', newList);

    // Inform other players that a new player has joined
    socket.broadcast.to(lobbyId ?? '').emit('newPlayer', newPlayer);

    players.set(lobbyId, newList);

    if (playlist.data) {
      socket.emit('playlist', {
        playlist: playlist.data,
        trivia: playlist.trivia,
      });
    }

    if (guesses.size) {
      socket.emit('guesses', Array.from(guesses.entries()));
    }

    socket.on('disconnect', () => {
      console.log('Client disconnected');

      const currentPlayers = players.get(lobbyId) ?? [];
      const disconnectedPlayer = currentPlayers.find(
        (player) => player.id === socket.id
      );

      if (!disconnectedPlayer) {
        return;
      }

      const newList = currentPlayers
        .filter((player) => player.id !== disconnectedPlayer?.id)
        .map<Player>((player, index) => ({
          ...player,
          isHost: player.isHost || (disconnectedPlayer.isHost && index === 0),
        }));

      players.set(lobbyId, newList);
      guesses.delete(socket.id);

      socket.broadcast.to(lobbyId ?? '').emit('playerList', newList);
    });

    socket.on('setPlaylist', async (playlistId: string) => {
      const response = await fetch(
        `http://localhost:3000/api/spotify/playlists/${playlistId}`
      );

      const data = await response.json();
      playlist.data = data.data;
      playlist.url = playlistId;
      playlist.trivia = getSongs(data.data);
      io.to(lobbyId).emit('playlist', {
        playlist: data.data,
        trivia: playlist.trivia,
      });
    });

    socket.on('guess', (data: { questionId: string; answerId: string }) => {
      console.log('RECEIVED GUESS');

      guesses.set(socket.id, [
        ...(guesses.get(socket.id) ?? []),
        {
          questionId: data.questionId,
          answerId: data.answerId,
        },
      ]);

      socket.broadcast.to(lobbyId).emit('guess', {
        questionId: data.questionId,
        answerId: data.answerId,
        playerId: socket.id,
      });
    });
  });

  server.all('*', (req, res) => {
    return handle(req, res);
  });

  const PORT = process.env.PORT || 3000;
  httpServer.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
  });
});
