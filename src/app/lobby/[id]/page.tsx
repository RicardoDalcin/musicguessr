"use client";

import { Trivia } from "@/components/Trivia";
import { Player, Playlist, TriviaQuestion } from "@/types";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Socket, io } from "socket.io-client";

type GameState =
  | "lobby"
  | "startGame"
  | "questionIntro"
  | "question"
  | "questionResult"
  | "gameOver";

let connected = false;

let socket: Socket | null = null;

export default function Lobby({ params }: { params: { id: string } }) {
  const [playlistUrl, setPlaylistUrl] = useState<string>("");
  const [playlist, setPlaylist] = useState<Playlist | null>(null);
  const [questionNumber, setQuestionNumber] = useState<number>(0);
  const [question, setQuestion] = useState<TriviaQuestion | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [guesses, setGuesses] = useState<
    Map<string, { questionId: string; answerId: string }[]>
  >(new Map());

  const [countdown, setCountdown] = useState<number>(0);
  const [countdownTotal, setCountdownTotal] = useState<number>(0);

  const [gameState, setGameState] = useState<GameState>("lobby");

  const me = useMemo(
    () => players.find((player) => player.id === socket?.id),
    [players]
  );

  const myGuesses = useMemo(
    () => guesses.get(socket?.id ?? "") ?? [],
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

  let interval: NodeJS.Timeout | null = null;

  function startCountdown(from: number) {
    if (interval) {
      clearInterval(interval);
    }

    setCountdownTotal(from);
    setCountdown(from * 1000);

    interval = setInterval(() => {
      setCountdown((countdown) => countdown - 10);
    }, 10);

    return () => interval && clearInterval(interval);
  }

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

    socket.on("newPlayer", (data: Player) => {
      console.log("player connected", data);
      setPlayers((players) => [...players, data]);
    });

    socket.on("playerList", (data: Player[]) => {
      setPlayers(data);
    });

    socket.on(
      "playlist",
      ({
        playlist,
        trivia,
      }: {
        playlist: Playlist;
        trivia: TriviaQuestion[];
      }) => {
        setPlaylist(playlist);
        // setTrivia(trivia);
      }
    );

    socket.on(
      "guesses",
      (data: [string, { questionId: string; answerId: string }[]][]) => {
        setGuesses(new Map(data));
      }
    );

    socket.on(
      "guess",
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

    socket.on("startGame", () => {
      setGameState("startGame");
      startCountdown(5);
    });

    socket.on("questionIntro", (questionNumber: number) => {
      setQuestionNumber(questionNumber);
      setGameState("questionIntro");
      startCountdown(3);
    });

    socket.on("question", (question: TriviaQuestion) => {
      setQuestion(question);
      setGameState("question");
      startCountdown(10);
    });

    socket.on("questionResult", () => {
      setGameState("questionResult");
      startCountdown(5);
    });

    socket.on("gameOver", () => {
      setGameState("gameOver");
    });

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function selectPlaylist() {
    if (!socket) {
      return;
    }

    // setIsLoading(true);
    // setError(null);

    const isSpotifyUrl = new RegExp(
      "^(https://open.spotify.com(/intl-.+)?/playlist/).+"
    ).test(playlistUrl);

    const playlistId =
      playlistUrl.split("playlist/").pop()?.split("?")[0] ?? "";

    if (!isSpotifyUrl || !playlistId) {
      // setError(
      //   'A URL inserida não é válida. Por favor, insira uma URL válida.'
      // );
      // setIsLoading(false);
      return;
    }

    socket.emit("setPlaylist", playlistId);
  }

  function startGame() {
    if (!socket) {
      return;
    }

    socket.emit("startGame");
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

    socket.emit("guess", { questionId, answerId });
  }, []);

  return (
    <main className="flex flex-col items-center justify-between gap-8 px-8 py-24 md:p-24 min-h-screen bg-[#0f1132] text-indigo-50">
      <div className="flex flex-col gap-4">
        <div className="w-[320px] h-[320px] rounded-xl overflow-hidden bg-neutral-100">
          {playlist ? (
            <img
              src={playlist.images[0].url}
              alt={playlist.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-2xl font-bold">
              Loading...
            </div>
          )}
        </div>

        {me && me.isHost && (
          <div className="flex flex-col gap-4">
            <div className="flex items-center">
              <input
                value={playlistUrl}
                onChange={(e) => setPlaylistUrl(e.target.value)}
                placeholder="Playlist URL"
                className="flex h-10 w-full rounded-l-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              />

              <button
                className="h-10 rounded-r-md bg-indigo-500 text-white text-sm font-medium px-2"
                onClick={selectPlaylist}
              >
                Choose
              </button>
            </div>
          </div>
        )}

        <div className="flex flex-col gap-1">
          <div>Players: {players.map((player) => player.name).join(", ")}</div>
          {me && me.isHost && <button onClick={startGame}>Start game</button>}
        </div>

        <div className="h-4 rounded-full w-[320px] bg-neutral-100 relative">
          <div
            className="h-full bg-indigo-500 rounded-full"
            style={{ width: `${(countdown / 1000 / countdownTotal) * 100}%` }}
          ></div>
        </div>

        {gameState === "startGame" && <p>Are you ready?</p>}
        {gameState === "questionIntro" && <p>Question {questionNumber}</p>}
        {gameState === "question" && question && (
          <div className="flex flex-col">
            <p>Guess the artist/song</p>

            <div
              key={question.index}
              className="flex flex-col items-center gap-4 p-4 border border-gray-300 rounded"
            >
              <h2 className="text-lg font-bold">
                {question.index}.{" "}
                {/* {hasGuessed(question.id) ? question.song : "??????"} */}
              </h2>
              <audio controls src={question.preview} />
              <div className="flex flex-col items-center gap-4">
                <h3 className="text-lg font-bold">Options:</h3>
                {question.options.map((option, i) => (
                  <button
                    key={i}
                    onClick={() => onGuess(question.id, option.id)}
                    // disabled={hasGuessed(question.id)}
                    // className={classNames(
                    //   "w-full py-1 text-white rounded transition-colors duration-200 ease-in-out relative",
                    //   getGuessColor(question, option.id)
                    // )}
                  >
                    {/* {getOtherGuesses(question.id)
                      .filter((guess) => guess.answerId === option.id)
                      .map((guess) => {
                        return (
                          <div
                            key={guess.playerId}
                            className="absolute w-4 h-4 rounded-full bg-red-500 top-0 left-0"
                          />
                        );
                      })} */}

                    {option.name}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
        {gameState === "questionResult" && <p>Question results</p>}

        {/* <div className="flex flex-col gap-8">Lobby: {params.id}</div>

        <div className="flex flex-col gap-8">
          Players: {players.map((player) => player.name).join(", ")}
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


            Trivia
              playlist={playlist}
              myGuesses={myGuesses}
              otherGuesses={otherGuesses}
              onGuess={onGuess}
              trivia={trivia}
            />
          </div>
        )}

        <div>{gameState}</div> */}
      </div>
    </main>
  );
}
