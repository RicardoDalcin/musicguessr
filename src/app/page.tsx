"use client";
import Image from "next/image";
import { useCallback, useEffect, useState } from "react";

import { Playlist } from "@/types";
import classNames from "classnames";

interface TriviaQuestion {
  id: string;
  song: string;
  artist: string;
  preview: string;
  guessType: "artist" | "song";
  rightAnswerId: string;
  options: {
    id: string;
    name: string;
  }[];
}

export default function Home() {
  const [playlistURL, setplaylistURL] = useState(
    "https://open.spotify.com/playlist/4TRhJ30Nq7x9AfoTyFruig?si=502b48c5c7194dd4"
  );

  const [playlistResult, setPlaylistResult] = useState<Playlist | null>(null);
  const [trivia, setTrivia] = useState<TriviaQuestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [guesses, setGuesses] = useState<
    {
      questionId: string;
      answerId: string;
    }[]
  >([]);

  const authenticate = useCallback(async () => {
    const token = localStorage.getItem("spotify_access_token");

    if (token) {
      const { accessToken, expiresAt } = JSON.parse(token);

      if (Date.now() < expiresAt) {
        return accessToken;
      }
    }

    const response = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: process.env.SPOTIFY_CLIENT_ID ?? "",
        client_secret: process.env.SPOTIFY_CLIENT_SECRET ?? "",
      }),
    });

    const access: {
      access_token: string;
      token_type: string;
      expires_in: number;
    } = await response.json();

    localStorage.setItem(
      "spotify_access_token",
      JSON.stringify({
        accessToken: access.access_token,
        expiresAt: Date.now() + access.expires_in * 1000,
      })
    );

    return access.access_token;
  }, []);

  const loadPlaylist = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    const token = await authenticate();

    const isSpotifyUrl = new RegExp(
      "^(https://open.spotify.com(/intl-.+)?/playlist/).+"
    ).test(playlistURL);

    const playlistId =
      playlistURL.split("playlist/").pop()?.split("?")[0] ?? "";

    if (!isSpotifyUrl || !playlistId) {
      setError(
        "A URL inserida não é válida. Por favor, insira uma URL válida."
      );
      setIsLoading(false);
      return;
    }

    const response = await fetch(
      new URL(`https://api.spotify.com/v1/playlists/${playlistId}`).toString(),
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );
    const data = (await response.json()) as Playlist;

    console.log(data);
    setPlaylistResult(data);
    setTrivia(getSongs(data));
    setIsLoading(false);
  }, [playlistURL, authenticate]);

  useEffect(() => {
    loadPlaylist();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
        .filter(
          (name) => name !== (isArtist ? song.artists[0].name : song.name)
        )
        .sort(() => Math.random() - 0.5)
        .slice(0, 3);

      const questionId = Math.random().toString(36).substring(7);
      const rightAnswerId = isArtist ? song.artists[0].id : song.id;

      return {
        id: questionId,
        song: song.name,
        artist: song.artists[0].name,
        preview: song.preview_url ?? "",
        guessType: isArtist ? "artist" : ("song" as "artist" | "song"),
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

  const handleGuess = useCallback((questionId: string, answerId: string) => {
    setGuesses((prev) => [
      ...prev,
      {
        questionId,
        answerId,
      },
    ]);
  }, []);

  const hasGuessed = useCallback(
    (questionId: string) => {
      return guesses.some((guess) => guess.questionId === questionId);
    },
    [guesses]
  );

  const getGuess = useCallback(
    (questionId: string) => {
      return guesses.find((guess) => guess.questionId === questionId);
    },
    [guesses]
  );

  function getGuessColor(question: TriviaQuestion, optionId: string) {
    const guess = getGuess(question.id);

    if (guess) {
      if (question.rightAnswerId === optionId) {
        return "bg-green-500 hover:bg-green-600";
      }

      if (guess.answerId === optionId) {
        return "bg-red-500 hover:bg-red-600";
      }
    }

    return "bg-gray-300 hover:bg-gray-400";
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-between px-8 py-24 md:p-24 bg-neutral-200">
      <div className="flex flex-col items-center gap-4 w-full max-w-[600px]">
        {error && (
          <div className="bg-red-500 text-white p-2 rounded">{error}</div>
        )}

        <input
          value={playlistURL}
          onChange={(e) => setplaylistURL(e.target.value)}
          type="text"
          className="w-full p-2 border text-black border-gray-300 rounded"
        />

        <button
          disabled={isLoading || !playlistURL}
          className="bg-green-500 w-full py-1 disabled:bg-gray-400 text-white rounded transition-colors duration-200 ease-in-out hover:bg-green-600"
          onClick={loadPlaylist}
        >
          {isLoading ? "Loading..." : "Send"}
        </button>

        {playlistResult && (
          <div className="flex flex-col items-center gap-4">
            <h1 className="text-2xl font-bold">{playlistResult.name}</h1>
            <p className="text-lg text-center">{playlistResult.description}</p>
            <p className="text-lg text-center">
              {playlistResult.followers.total} followers
            </p>
            <a
              href={playlistResult.external_urls.spotify}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-500 underline"
            >
              Open on Spotify
            </a>
          </div>
        )}

        {
          <div className="flex flex-col items-center gap-4">
            {trivia.map((question, index) => (
              <div
                key={index}
                className="flex flex-col items-center gap-4 p-4 border border-gray-300 rounded"
              >
                <h2 className="text-lg font-bold">
                  {index + 1}.{" "}
                  {hasGuessed(question.id) ? question.song : "??????"}
                </h2>
                <audio controls src={question.preview} />
                <div className="flex flex-col items-center gap-4">
                  <h3 className="text-lg font-bold">Options:</h3>
                  {question.options.map((option, i) => (
                    <button
                      key={i}
                      onClick={() => handleGuess(question.id, option.id)}
                      disabled={hasGuessed(question.id)}
                      className={classNames(
                        "w-full py-1 text-white rounded transition-colors duration-200 ease-in-out",
                        getGuessColor(question, option.id)
                      )}
                    >
                      {option.name}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        }
      </div>
    </main>
  );
}

