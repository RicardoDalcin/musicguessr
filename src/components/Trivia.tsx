'use client';
import { useCallback, useEffect, useState } from 'react';
import { Playlist, TriviaQuestion } from '@/types';
import classNames from 'classnames';

export function Trivia({
  playlist,
  myGuesses,
  otherGuesses,
  onGuess,
  trivia,
}: {
  playlist: Playlist;
  myGuesses: { questionId: string; answerId: string }[];
  otherGuesses: {
    questionId: string;
    answerId: string;
    playerId: string;
  }[];
  onGuess: (questionId: string, answerId: string) => void;
  trivia: TriviaQuestion[];
}) {
  const [error, setError] = useState<string | null>(null);

  const hasGuessed = useCallback(
    (questionId: string) =>
      myGuesses.some((guess) => guess.questionId === questionId),
    [myGuesses]
  );

  const getGuess = useCallback(
    (questionId: string) =>
      myGuesses.find((guess) => guess.questionId === questionId),
    [myGuesses]
  );

  const getOtherGuesses = useCallback(
    (questionId: string) => {
      return otherGuesses.filter((guess) => guess.questionId === questionId);
    },
    [otherGuesses]
  );

  function getGuessColor(question: TriviaQuestion, optionId: string) {
    const guess = getGuess(question.id);

    if (guess) {
      if (question.rightAnswerId === optionId) {
        return 'bg-green-500 hover:bg-green-600';
      }

      if (guess.answerId === optionId) {
        return 'bg-red-500 hover:bg-red-600';
      }
    }

    return 'bg-gray-300 hover:bg-gray-400';
  }

  return (
    <div className="flex flex-col items-center gap-4 w-full max-w-[600px]">
      {error && (
        <div className="bg-red-500 text-white p-2 rounded">{error}</div>
      )}

      {playlist && (
        <div className="flex flex-col items-center gap-4">
          <h1 className="text-2xl font-bold">{playlist.name}</h1>
          <p className="text-lg text-center">{playlist.description}</p>
          <p className="text-lg text-center">
            {playlist.followers.total} followers
          </p>
          <a
            href={playlist.external_urls.spotify}
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
                {index + 1}.{' '}
                {hasGuessed(question.id) ? question.song : '??????'}
              </h2>
              <audio controls src={question.preview} />
              <div className="flex flex-col items-center gap-4">
                <h3 className="text-lg font-bold">Options:</h3>
                {question.options.map((option, i) => (
                  <button
                    key={i}
                    onClick={() => onGuess(question.id, option.id)}
                    disabled={hasGuessed(question.id)}
                    className={classNames(
                      'w-full py-1 text-white rounded transition-colors duration-200 ease-in-out relative',
                      getGuessColor(question, option.id)
                    )}
                  >
                    {getOtherGuesses(question.id)
                      .filter((guess) => guess.answerId === option.id)
                      .map((guess) => {
                        return (
                          <div
                            key={guess.playerId}
                            className="absolute w-4 h-4 rounded-full bg-red-500 top-0 left-0"
                          />
                        );
                      })}

                    {option.name}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      }
    </div>
  );
}
