import express from 'express';
import next from 'next';
import http from 'http';
import { Server, Socket } from 'socket.io';
import {
  ClientTriviaQuestion,
  Player,
  Playlist,
  TriviaQuestion,
} from '@/types';

const START_GAME_TIME = 5000;
const QUESTION_INTRO_TIME = 3000;
const QUESTION_TIME = 10000;
const QUESTION_RESULT_TIME = 5000;

let timeout: NodeJS.Timeout | null = null;
let interval: NodeJS.Timeout | null = null;

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();

interface Lobby {
  players: Player[];
  url: string;
  playlist: Playlist | null;
  trivia: TriviaQuestion[];
  guesses: Map<string, { questionId: string; answerId: string }[]>;
  currentQuestion: number;
}

const getDefaultLobby = (): Lobby => ({
  players: [],
  url: '',
  playlist: null,
  trivia: [],
  guesses: new Map(),
  currentQuestion: 1,
});

const lobbies = new Map<string, Lobby>();

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
  return songs.map((song, index) => {
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
      index: index + 1,
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

function getQuestionResult(
  question: TriviaQuestion,
  guesses: Map<string, { questionId: string; answerId: string }[]>
) {
  const questionGuesses = Array.from(guesses.entries()).flatMap(
    ([playerId, playerGuesses]) =>
      playerGuesses
        .filter((g) => g.questionId === question.id)
        .map((g) => ({ playerId, answerId: g.answerId }))
  );

  return questionGuesses;
}

app.prepare().then(async () => {
  const server = express();
  const httpServer = http.createServer(server);
  const io = new Server(httpServer);

  io.on('connection', (socket) => {
    const lobbyId = (socket.handshake.query.lobbyId ?? '') as string;
    console.log('Client connected');

    socket.join(lobbyId ?? '');

    const lobby = lobbies.get(lobbyId) ?? getDefaultLobby();
    lobbies.set(lobbyId, lobby);

    const newPlayer: Player = {
      id: socket.id,
      name: generateName(),
      isHost: lobby.players.length === 0,
    };

    const newList = [...lobby.players, newPlayer];

    // Inform the new player about the other players
    socket.emit('playerList', newList);

    // Inform other players that a new player has joined
    socket.broadcast.to(lobbyId ?? '').emit('newPlayer', newPlayer);

    lobby.players = newList;

    if (lobby.playlist) {
      socket.emit('playlist', {
        playlist: lobby.playlist,
        trivia: lobby.trivia,
      });
    }

    if (lobby.guesses.size) {
      socket.emit('guesses', Array.from(lobby.guesses.entries()));
    }

    socket.on('disconnect', () => {
      console.log('Client disconnected');

      const disconnectedPlayer = lobby.players.find(
        (player) => player.id === socket.id
      );

      if (!disconnectedPlayer) {
        return;
      }

      const newList = lobby.players
        .filter((player) => player.id !== disconnectedPlayer?.id)
        .map<Player>((player, index) => ({
          ...player,
          isHost: player.isHost || (disconnectedPlayer.isHost && index === 0),
        }));

      lobby.players = newList;
      lobby.guesses.delete(socket.id);

      if (newList.length === 0) {
        timeout && clearTimeout(timeout);
        interval && clearInterval(interval);
        lobby.currentQuestion = 1;
        lobby.guesses.clear();
        return;
      }

      socket.broadcast.to(lobbyId ?? '').emit('playerList', newList);
    });

    socket.on('setPlaylist', async (playlistId: string) => {
      const lobby = lobbies.get(lobbyId);
      if (!lobby) {
        return;
      }

      const response = await fetch(
        `http://localhost:3000/api/spotify/playlists/${playlistId}`
      );

      const data = await response.json();
      lobby.playlist = data.data;
      lobby.url = playlistId;
      lobby.trivia = getSongs(data.data);
      io.to(lobbyId).emit('playlist', {
        playlist: data.data,
        trivia: lobby.trivia,
      });
    });

    socket.on('startGame', () => {
      io.to(lobbyId).emit('startGame');
      lobby.guesses.clear();

      const TOTAL_QUESTION_TIME =
        QUESTION_INTRO_TIME + QUESTION_TIME + QUESTION_RESULT_TIME;

      function question() {
        io.to(lobbyId).emit('questionIntro', lobby.currentQuestion);

        timeout = setTimeout(() => {
          const question = lobby.trivia[lobby.currentQuestion - 1];
          const clientQuestion = { ...question } as Partial<TriviaQuestion>;
          delete clientQuestion.rightAnswerId;

          io.to(lobbyId).emit(
            'question',
            clientQuestion as ClientTriviaQuestion
          );

          timeout = setTimeout(() => {
            io.to(lobbyId).emit('questionResult', {
              question,
              guesses: getQuestionResult(question, lobby.guesses),
            });

            timeout = setTimeout(() => {
              const nextQuestion = lobby.currentQuestion + 1;
              lobby.currentQuestion = nextQuestion;
              if (nextQuestion < lobby.trivia.length) {
                io.to(lobbyId).emit('questionIntro', nextQuestion);
              } else {
                io.to(lobbyId).emit('gameOver');
                interval && clearInterval(interval);
              }
            }, QUESTION_RESULT_TIME);
          }, QUESTION_TIME);
        }, QUESTION_INTRO_TIME);
      }

      timeout = setTimeout(() => {
        question();

        interval = setInterval(() => {
          question();
        }, TOTAL_QUESTION_TIME);
      }, START_GAME_TIME);
    });

    socket.on('guess', (data: { questionId: string; answerId: string }) => {
      lobby.guesses.set(socket.id, [
        ...(lobby.guesses.get(socket.id) ?? []),
        {
          questionId: data.questionId,
          answerId: data.answerId,
        },
      ]);

      socket.broadcast.to(lobbyId).emit('guess', {
        questionId: data.questionId,
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
