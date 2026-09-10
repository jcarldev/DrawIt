"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import DrawingCanvas from "@components/DrawingCanvas";
import PlayerList from "@components/PlayerList";
import Chat, { type ChatMessage } from "@components/Chat";
import Timer from "@components/Timer";
import { socket } from "@/lib/socket";

type Player = {
  id: string;
  username: string;
  score: number;
};

type Room = {
  code: string;
  hostId: string;
  players: Player[];
  status: "waiting" | "playing" | "finished";
  drawerId: string | null;
  roundStartedAt: number | null;
  roundDuration: number;
  currentPlayerIndex: number;
  currentRound: number;
  totalRounds: number;
  settings: {
    rounds: number;
    roundDuration: number;
    wordPool: "mixed" | "animals" | "food" | "objects" | "places";
  };
};

type DrawData = {
  x: number;
  y: number;
  previousX: number;
  previousY: number;
  color: string;
  lineWidth: number;
  tool: "brush" | "eraser";
};

export default function GamePage() {
  const router = useRouter();

  const [roomCode, setRoomCode] = useState("");

  const [players, setPlayers] = useState<Player[]>([]);

  const [drawerId, setDrawerId] = useState<string | null>(null);

  const [currentPlayerId, setCurrentPlayerId] = useState("");

  const [word, setWord] = useState("");

  const [wordLength, setWordLength] = useState(0);

  const [messages, setMessages] = useState<ChatMessage[]>([]);

  const [running, setRunning] = useState(false);

  const [duration, setDuration] = useState(60);

  const [roundStartedAt, setRoundStartedAt] = useState<number | null>(null);

  const [currentRound, setCurrentRound] = useState(0);

  const [totalRounds, setTotalRounds] = useState(0);

  const [gameFinished, setGameFinished] = useState(false);

  const [error, setError] = useState("");

  const isDrawer = currentPlayerId !== "" && drawerId === currentPlayerId;

  useEffect(() => {
    const path = window.location.pathname;

    const parts = path.split("/").filter(Boolean);

    const gameIndex = parts.indexOf("game");

    const code =
      gameIndex !== -1 ? parts[gameIndex + 1]?.trim().toUpperCase() : "";

    if (!code) {
      setError("Room ID not found in URL.");

      return;
    }

    setRoomCode(code);
  }, []);

  useEffect(() => {
    if (!roomCode) {
      return;
    }

    function handleConnect() {
      if (!socket.id) {
        return;
      }

      setCurrentPlayerId(socket.id);

      socket.emit("get-room", {
        roomCode,
      });
    }

    function handleRoomUpdated(room: Room) {
      if (room.code !== roomCode) {
        return;
      }

      setPlayers(room.players);

      setDrawerId(room.drawerId);

      setCurrentRound(room.currentRound);

      setTotalRounds(room.totalRounds);

      if (room.status === "playing" && room.roundStartedAt !== null) {
        setDuration(room.roundDuration);

        setRoundStartedAt(room.roundStartedAt);

        setRunning(true);
        setGameFinished(false);
      } else {
        setRunning(false);
        setRoundStartedAt(null);
      }

      if (room.status === "finished" && room.currentRound > room.totalRounds) {
        setGameFinished(true);
      }
    }

    function handleGameStarted(data: {
      room: Room;
      drawerId: string;
      roundStartedAt: number;
      duration: number;
    }) {
      if (data.room.code !== roomCode) {
        return;
      }

      setPlayers(data.room.players);

      setDrawerId(data.drawerId);

      setCurrentRound(data.room.currentRound);

      setTotalRounds(data.room.totalRounds);

      setDuration(data.duration);

      setRoundStartedAt(data.roundStartedAt);

      setRunning(true);

      setGameFinished(false);

      setWord("");
      setWordLength(0);
      setMessages([]);
    }

    function handleYourWord(data: { word: string }) {
      setWord(data.word);

      setWordLength(data.word.length);
    }

    function handleWordLength(data: { length: number }) {
      setWordLength(data.length);
    }

    function handleChatMessage(message: ChatMessage) {
      setMessages((current) => [...current, message]);
    }

    function handleCorrectGuessMessage(data: { username: string }) {
      setMessages((current) => [
        ...current,
        {
          id: `correct-${Date.now()}-${Math.random()}`,
          username: "System",
          message: `${data.username} guessed correctly!`,
          correct: true,
        },
      ]);
    }

    function handleCorrectGuess(data: {
      playerId: string;
      username: string;
      score: number;
    }) {
      setPlayers((current) =>
        current.map((player) =>
          player.id === data.playerId
            ? {
                ...player,
                score: data.score,
              }
            : player,
        ),
      );
    }

    function handleRoundEnded() {
      setRunning(false);

      setWord("");

      setWordLength(0);

      setRoundStartedAt(null);
    }

    function handleGameFinished() {
      setRunning(false);

      setWord("");

      setWordLength(0);

      setRoundStartedAt(null);

      setDrawerId(null);

      setGameFinished(true);
    }

    function handleError(message: string) {
      console.error("Game error:", message);

      setError(message);
    }

    if (socket.connected) {
      if (socket.id) {
        setCurrentPlayerId(socket.id);
      }

      socket.emit("get-room", {
        roomCode,
      });
    } else {
      socket.once("connect", handleConnect);

      socket.connect();
    }

    socket.on("room-updated", handleRoomUpdated);

    socket.on("game-started", handleGameStarted);

    socket.on("your-word", handleYourWord);

    socket.on("word-length", handleWordLength);

    socket.on("chat-message", handleChatMessage);

    socket.on("correct-guess-message", handleCorrectGuessMessage);

    socket.on("correct-guess", handleCorrectGuess);

    socket.on("round-ended", handleRoundEnded);

    socket.on("game-finished", handleGameFinished);

    socket.on("error-message", handleError);

    return () => {
      socket.off("connect", handleConnect);

      socket.off("room-updated", handleRoomUpdated);

      socket.off("game-started", handleGameStarted);

      socket.off("your-word", handleYourWord);

      socket.off("word-length", handleWordLength);

      socket.off("chat-message", handleChatMessage);

      socket.off("correct-guess-message", handleCorrectGuessMessage);

      socket.off("correct-guess", handleCorrectGuess);

      socket.off("round-ended", handleRoundEnded);

      socket.off("game-finished", handleGameFinished);

      socket.off("error-message", handleError);
    };
  }, [roomCode]);

  function handleDraw(data: DrawData) {
    if (!isDrawer) {
      return;
    }

    socket.emit("draw", {
      roomCode,
      ...data,
    });
  }

  function handleClear() {
    if (!isDrawer) {
      return;
    }

    socket.emit("clear-canvas", {
      roomCode,
    });
  }

  function sendGuess(message: string) {
    if (isDrawer) {
      return;
    }

    socket.emit("guess", {
      roomCode,
      guess: message,
    });
  }

  const handleTimerComplete = useCallback(() => {
    setRunning(false);
  }, []);

  function handleLeave() {
    socket.emit("leave-room", {
      roomCode,
    });

    router.push("/");
  }

  function handleBackHome() {
    socket.emit("leave-room", {
      roomCode,
    });

    router.push("/");
  }

  if (error) {
    return (
      <main className="flex min-h-screen items-center justify-center px-6">
        <div className="text-center">
          <div className="text-5xl">❌</div>

          <h1 className="mt-5 text-2xl font-bold text-gray-900">
            Unable to Load Game
          </h1>

          <p className="mt-2 text-sm text-red-500">{error}</p>

          <button
            onClick={() => router.push("/")}
            className="mt-6 rounded-xl bg-purple-600 px-5 py-3 font-semibold text-white"
          >
            Back to Home
          </button>
        </div>
      </main>
    );
  }

  if (!roomCode || !currentPlayerId) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="text-4xl">🎨</div>

          <h1 className="mt-4 text-2xl font-bold text-gray-900">
            Loading Game...
          </h1>

          <p className="mt-2 font-mono text-sm text-purple-600">
            {roomCode || "Reading room ID..."}
          </p>
        </div>
      </main>
    );
  }

  if (gameFinished) {
    const sortedPlayers = [...players].sort((a, b) => b.score - a.score);

    const winner = sortedPlayers[0];

    return (
      <main className="min-h-screen px-4 py-10">
        <div className="mx-auto max-w-3xl">
          <div className="mb-8 text-center">
            <div className="text-6xl">🏆</div>

            <h1 className="mt-4 text-4xl font-extrabold">Game Over!</h1>

            <p className="mt-2">
              All players have completed their drawing turns.
            </p>

            <p className="mt-1 text-sm font-medium">Room: {roomCode}</p>
          </div>

          {winner && (
            <div className="mb-6 rounded-2xl border border-purple-200 bg-purple-50 p-6 text-center shadow-sm">
              <p className="text-xs font-bold uppercase tracking-wider text-purple-500">
                Winner
              </p>

              <div className="mt-2 text-3xl">👑</div>

              <h2 className="mt-1 text-2xl font-extrabold text-gray-900">
                {winner.username}
              </h2>

              <p className="mt-1 text-lg font-bold text-purple-600">
                {winner.score} points
              </p>
            </div>
          )}

          <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-lg">
            <div className="border-b border-gray-200 bg-gray-50 px-5 py-4">
              <h2 className="text-lg font-bold text-gray-900">Final Scores</h2>

              <p className="text-sm text-gray-400">
                {totalRounds} {totalRounds === 1 ? "round" : "rounds"} completed
              </p>
            </div>

            <div className="divide-y divide-gray-100">
              {sortedPlayers.map((player, index) => (
                <div
                  key={player.id}
                  className="flex items-center justify-between px-5 py-4"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 text-sm font-bold text-gray-600">
                      {index === 0
                        ? "🥇"
                        : index === 1
                          ? "🥈"
                          : index === 2
                            ? "🥉"
                            : index + 1}
                    </div>

                    <div>
                      <p className="font-semibold text-gray-900">
                        {player.username}
                      </p>

                      {player.id === currentPlayerId && (
                        <p className="text-xs text-purple-500">You</p>
                      )}
                    </div>
                  </div>

                  <p className="text-lg font-extrabold text-gray-900">
                    {player.score}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-6 flex justify-center">
            <button
              onClick={handleBackHome}
              className="rounded-xl bg-purple-600 px-6 py-3 font-semibold text-white transition hover:bg-purple-700"
            >
              Back to Home
            </button>
          </div>
        </div>
      </main>
    );
  }

  const displayWord = isDrawer
    ? word || "..."
    : wordLength > 0
      ? Array.from(
          {
            length: wordLength,
          },
          () => "_",
        ).join(" ")
      : "...";

  return (
    <main className="min-h-screen px-4 py-6">
      <div className="mx-auto mb-5 flex max-w-7xl items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold">🎨 Draw It</h1>

          <p className="text-sm text-gray-400">Room: {roomCode}</p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 shadow-sm">
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">
              Round
            </span>

            <span className="font-bold text-gray-900">
              {currentRound || 0}/{totalRounds || players.length}
            </span>
          </div>

          <Timer
            duration={duration}
            running={running}
            startTime={roundStartedAt}
            onComplete={handleTimerComplete}
          />

          <button
            onClick={handleLeave}
            className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100"
          >
            Leave
          </button>
        </div>
      </div>

      <div className="mx-auto max-w-7xl">
        <div className="mb-4 rounded-2xl border border-gray-200 bg-white p-4 text-center shadow-lg">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
            {isDrawer ? "Your word" : "Guess the word"}
          </p>

          <p className="mt-2 text-3xl font-extrabold tracking-[0.3em] text-gray-900">
            {displayWord}
          </p>

          <p className="mt-2 text-sm text-gray-500">
            {isDrawer ? "Draw this word!" : "What is being drawn?"}
          </p>
        </div>

        <div className="grid gap-5 lg:grid-cols-[220px_minmax(0,1fr)_280px]">
          <div className="min-w-0">
            <PlayerList
              players={players}
              drawerId={drawerId}
              currentPlayerId={currentPlayerId}
            />
          </div>

          <div className="min-w-0">
            <DrawingCanvas
              disabled={!isDrawer}
              onDraw={handleDraw}
              onClear={handleClear}
            />
          </div>

          <div className="min-h-[350px] min-w-0">
            <Chat messages={messages} onSend={sendGuess} disabled={isDrawer} />
          </div>
        </div>
      </div>
    </main>
  );
}
