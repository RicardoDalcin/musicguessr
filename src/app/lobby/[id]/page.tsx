"use client";

import {
  ClientTriviaQuestion,
  Player,
  Playlist,
  TriviaQuestion,
} from "@/types";
import classNames from "classnames";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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

interface QuestionResult {
  question: TriviaQuestion;
  guesses: { playerId: string; answerId: string; time: number }[];
}

export default function Lobby({ params }: { params: { id: string } }) {
  const [playlistUrl, setPlaylistUrl] = useState<string>(
    "https://open.spotify.com/playlist/4TRhJ30Nq7x9AfoTyFruig?si=a2f544afb9d84807"
  );
  const [playlist, setPlaylist] = useState<Playlist | null>(null);
  const [questionNumber, setQuestionNumber] = useState<number>(0);
  const [question, setQuestion] = useState<ClientTriviaQuestion | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [guesses, setGuesses] = useState<
    Map<string, { questionId: string; answerId: string }[]>
  >(new Map());

  const [myGuesses, setMyGuesses] = useState<
    { questionId: string; answerId: string }[]
  >([]);

  const [countdown, setCountdown] = useState<number>(0);
  const [countdownTotal, setCountdownTotal] = useState<number>(0);

  const [gameState, setGameState] = useState<GameState>("lobby");
  const [result, setResult] = useState<QuestionResult | null>(null);

  const [volume, setVolume] = useState(1);
  const questionPlayer = useRef<HTMLAudioElement | null>(null);

  const me = useMemo(
    () => players.find((player) => player.id === socket?.id),
    [players]
  );

  // const myGuesses = useMemo(
  //   () => guesses.get(socket?.id ?? '') ?? [],
  //   [guesses]
  // );

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

    socket.on("question", (question: ClientTriviaQuestion) => {
      console.log("question", question);
      setQuestion(question);
      setGameState("question");
      startCountdown(10);

      setTimeout(() => {
        if (!questionPlayer.current) {
          return;
        }

        questionPlayer.current.volume = volume;
        questionPlayer.current.play();
      }, 50);
    });

    socket.on("questionResult", (result: QuestionResult) => {
      setGameState("questionResult");
      setResult(result);
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

    setMyGuesses((guesses) => [
      ...guesses,
      {
        questionId,
        answerId,
      },
    ]);

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

  const hasGuessed = useCallback(
    (questionId: string) => {
      return myGuesses.some((guess) => guess.questionId === questionId);
    },
    [myGuesses]
  );

  const getGuess = useCallback(
    (questionId: string) => {
      return myGuesses.find((guess) => guess.questionId === questionId);
    },
    [myGuesses]
  );

  function devQuestion() {
    setQuestion({
      id: "15lqvv",
      index: 1,
      song: "Wake Me Up",
      artist: "Foals",
      preview:
        "https://p.scdn.co/mp3-preview/c7836a4b712714b254825b6c48ea0371ff01bb00?cid=4e3d49ba29d744f3993b66302dc21db4",
      guessType: "song",
      options: [
        {
          id: "v042b",
          name: "Pumped Up Kicks",
        },
        {
          id: "30kt4e",
          name: "Extra Life",
        },
        {
          id: "4kSCNra5VuD1ZfiwAe8bTD",
          name: "Wake Me Up",
        },
        {
          id: "jl5ej3",
          name: "Stop Selling Her Drugs (feat. Dominic Fike)",
        },
      ],
      startTime: Date.now(),
    });

    setGameState("question");

    setTimeout(() => {
      if (!questionPlayer.current) {
        return;
      }

      questionPlayer.current.volume = volume;
      questionPlayer.current.play();
    }, 50);
  }

  return (
    <main className="flex flex-col items-center justify-between gap-8 px-8 py-24 md:p-24 min-h-screen bg-[#0f1132] text-indigo-50">
      {process.env.NODE_ENV === "development" && (
        <div className="absolute top-8 right-8 bg-white/20 p-4 rounded-xl flex flex-col gap-2 w-[280px]">
          <p>Dev menu</p>

          <button className="w-full py-1 text-left bg-black/10 px-2 rounded-md hover:bg-black/20 transition-colors">
            Question intro
          </button>

          <button
            onClick={devQuestion}
            className="w-full py-1 text-left bg-black/10 px-2 rounded-md hover:bg-black/20 transition-colors"
          >
            Question
          </button>

          <button className="w-full py-1 text-left bg-black/10 px-2 rounded-md hover:bg-black/20 transition-colors">
            Question result
          </button>
        </div>
      )}

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
                className="flex h-10 w-full rounded-l-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 text-black"
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
              <h2 className="text-lg font-bold">{question.index}. </h2>
              <audio
                ref={questionPlayer}
                src={question.preview}
                className="hidden"
              />
              <div className="grid grid-cols-2 gap-4">
                {question.options.map((option, i) => (
                  <button
                    key={i}
                    onClick={() => onGuess(question.id, option.id)}
                    className={classNames(
                      "w-[400px] py-6 rounded-lg relative bg-white/10 hover:bg-white/20 disabled:bg-white/5"
                    )}
                    disabled={hasGuessed(question.id)}
                  >
                    {hasGuessed(question.id) &&
                      getGuess(question.id)?.answerId === option.id && (
                        <div className="absolute top-1 right-1 w-4 h-4 bg-white/50 rounded-full"></div>
                      )}

                    {option.name}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
        {gameState === "questionResult" && (
          <div className="flex flex-col gap-2">
            <p>Question results</p>

            {result &&
              result.guesses.map((guess) => (
                <div
                  key={guess.playerId}
                  className="flex items-center gap-2 relative"
                >
                  <p>{guess.playerId}</p>
                  <p>{guess.answerId}</p>
                  <p>{guess.time}</p>
                </div>
              ))}

            {result &&
              result.question.options.map((option) => {
                const isRightAnswer =
                  option.id === result.question.rightAnswerId;
                const isMyAnswer = myGuesses.some(
                  (guess) => guess.answerId === option.id
                );

                return (
                  <div
                    key={option.id}
                    className={`flex items-center gap-2 relative ${
                      isRightAnswer ? "text-green-500" : "text-red-500"
                    }`}
                  >
                    {isMyAnswer && (
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-6 w-6"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    )}

                    {
                      result.guesses.filter(
                        (guess) => guess.answerId === option.id
                      ).length
                    }
                    <p>{option.name}</p>
                  </div>
                );
              })}
          </div>
        )}

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
