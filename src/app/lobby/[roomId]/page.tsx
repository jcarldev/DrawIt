"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { socket } from "@/lib/socket";

type Player = {
  id: string;
  username: string;
  score: number;
};

type WordPool = "mixed" | "animals" | "food" | "objects" | "places";

type RoomSettings = {
  rounds: number;
  roundDuration: number;
  wordPool: WordPool;
};

type Room = {
  code: string;
  hostId: string;
  players: Player[];
  status: "waiting" | "playing" | "finished";
  drawerId: string | null;
  settings: RoomSettings;
};

export default function LobbyPage() {
  const router = useRouter();

  const [roomId, setRoomId] = useState("");

  const [room, setRoom] = useState<Room | null>(null);

  const [error, setError] = useState("");

  const [copied, setCopied] = useState(false);

  const [showSettings, setShowSettings] = useState(false);

  const [rounds, setRounds] = useState(1);

  const [roundDuration, setRoundDuration] = useState(60);

  const [wordPool, setWordPool] = useState<WordPool>("mixed");

  useEffect(() => {
    const path = window.location.pathname;

    const parts = path.split("/").filter(Boolean);

    const urlRoomId = parts[1]?.trim().toUpperCase() || "";

    if (!urlRoomId) {
      setError("Room ID not found in URL.");

      return;
    }

    setRoomId(urlRoomId);

    function handleRoomUpdated(roomData: Room) {
      if (roomData.code !== urlRoomId) {
        return;
      }

      setRoom(roomData);
      setError("");

      setRounds(roomData.settings.rounds);

      setRoundDuration(roomData.settings.roundDuration);

      setWordPool(roomData.settings.wordPool);

      sessionStorage.setItem("draw-it-room", JSON.stringify(roomData));
    }

    function handleGameStarted(data: { room: Room }) {
      sessionStorage.setItem("draw-it-room", JSON.stringify(data.room));

      router.push(`/game/${data.room.code}`);
    }

    function handleError(message: string) {
      console.error("Server error:", message);

      setError(message);
    }

    function enterRoom() {
      const username = localStorage.getItem("username")?.trim() || "";

      const roomAction = localStorage.getItem("roomAction") || "";

      if (roomAction === "create") {
        socket.emit("get-room", {
          roomCode: urlRoomId,
        });

        return;
      }

      if (roomAction === "join") {
        if (!username) {
          setError("Username not found. Please return to the home page.");

          return;
        }

        socket.emit("join-room", {
          roomCode: urlRoomId,
          username,
        });

        return;
      }

      socket.emit("get-room", {
        roomCode: urlRoomId,
      });
    }

    socket.on("room-updated", handleRoomUpdated);

    socket.on("game-started", handleGameStarted);

    socket.on("error-message", handleError);

    if (socket.connected) {
      enterRoom();
    } else {
      const handleConnect = () => {
        enterRoom();
      };

      socket.once("connect", handleConnect);

      socket.connect();

      return () => {
        socket.off("connect", handleConnect);

        socket.off("room-updated", handleRoomUpdated);

        socket.off("game-started", handleGameStarted);

        socket.off("error-message", handleError);
      };
    }

    return () => {
      socket.off("room-updated", handleRoomUpdated);

      socket.off("game-started", handleGameStarted);

      socket.off("error-message", handleError);
    };
  }, [router]);

  async function copyRoomId() {
    if (!room) {
      return;
    }

    try {
      await navigator.clipboard.writeText(room.code);

      setCopied(true);

      setTimeout(() => {
        setCopied(false);
      }, 2000);
    } catch (error) {
      console.error("Failed to copy room ID:", error);
    }
  }

  function handleStart() {
    if (!room) {
      return;
    }

    socket.emit("start-game", {
      roomCode: room.code,
    });
  }

  function saveSettings() {
    if (!room) {
      return;
    }

    socket.emit("update-room-settings", {
      roomCode: room.code,
      rounds,
      roundDuration,
      wordPool,
    });

    setShowSettings(false);
  }

  function handleLeave() {
    if (room) {
      socket.emit("leave-room", {
        roomCode: room.code,
      });
    }

    sessionStorage.removeItem("draw-it-room");

    localStorage.removeItem("roomAction");

    router.push("/");
  }

  if (!room) {
    return (
      <main className="flex min-h-screen items-center justify-center px-6">
        <div className="w-full max-w-md text-center">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-purple-100 text-4xl shadow-sm">
            {error ? "❌" : "🎨"}
          </div>

          <h1 className="mt-6 text-3xl font-bold tracking-tight text-gray-900">
            {error ? "Unable to Load Lobby" : "Loading Lobby..."}
          </h1>

          <div className="mx-auto mt-4 inline-flex items-center gap-2 rounded-full border border-gray-200 bg-gray-50 px-4 py-2">
            <span className="text-sm text-gray-500">Room</span>

            <span className="font-mono text-sm font-bold tracking-widest text-purple-600">
              {roomId || "Loading..."}
            </span>
          </div>

          {error ? (
            <div className="mx-auto mt-6 max-w-sm rounded-xl border border-red-200 bg-red-50 p-4">
              <p className="text-sm font-medium text-red-600">{error}</p>
            </div>
          ) : (
            <div className="mt-8">
              <div className="flex justify-center gap-1.5">
                <span className="h-2 w-2 animate-bounce rounded-full bg-purple-600 [animation-delay:-0.3s]" />
                <span className="h-2 w-2 animate-bounce rounded-full bg-purple-600 [animation-delay:-0.15s]" />
                <span className="h-2 w-2 animate-bounce rounded-full bg-purple-600" />
              </div>

              <p className="mt-4 text-sm text-gray-500">
                Loading room information...
              </p>
            </div>
          )}

          <button
            onClick={() => router.push("/")}
            className="mt-8 rounded-xl border border-gray-200 bg-white px-6 py-3 text-sm font-semibold text-gray-700 shadow-sm transition hover:border-purple-200 hover:bg-purple-50 hover:text-purple-600"
          >
            Back to Home
          </button>
        </div>
      </main>
    );
  }

  const isHost = room.hostId === socket.id;

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-10">
      <div className="w-full max-w-2xl">
        <div className="rounded-3xl border border-gray-100 bg-white p-8 shadow-xl shadow-gray-200/50">
          <div className="text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-purple-500 to-blue-500 text-3xl shadow-lg shadow-purple-200">
              🎨
            </div>

            <h1 className="mt-5 text-3xl font-bold tracking-tight text-gray-900">
              Draw It
            </h1>

            <p className="mt-2 text-sm text-gray-500">
              Waiting for players to join...
            </p>
          </div>

          <div className="mt-8 rounded-2xl border border-purple-100 bg-purple-50/60 p-6 text-center">
            <p className="text-xs font-semibold uppercase tracking-wider text-purple-500">
              Room ID
            </p>

            <div className="mt-3 flex items-center justify-center gap-3">
              <span className="font-mono text-3xl font-bold tracking-[0.2em] text-gray-900">
                {room.code}
              </span>

              <button
                onClick={copyRoomId}
                className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 shadow-sm transition hover:border-purple-200 hover:bg-purple-50 hover:text-purple-600"
              >
                {copied ? "✓ Copied" : "Copy"}
              </button>
            </div>

            <p className="mt-2 text-xs text-gray-500">
              Share this code with your friends
            </p>
          </div>

          <div className="mt-8">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Players</h2>

                <p className="mt-1 text-sm text-gray-500">
                  {room.players.length === 1
                    ? "Waiting for someone to join..."
                    : "Ready to play!"}
                </p>
              </div>

              <span className="rounded-full bg-gray-100 px-3 py-1.5 text-sm font-semibold text-gray-600">
                {room.players.length}
                /8
              </span>
            </div>

            <div className="mt-5 space-y-3">
              {room.players.map((player) => (
                <div
                  key={player.id}
                  className="flex items-center justify-between rounded-2xl border border-gray-100 bg-gray-50 px-4 py-3.5"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-purple-100 to-blue-100 font-bold text-purple-700">
                      {player.username.charAt(0).toUpperCase()}
                    </div>

                    <div>
                      <p className="font-semibold text-gray-900">
                        {player.username}
                      </p>

                      <div className="mt-0.5 flex items-center gap-2 text-xs text-gray-500">
                        {player.id === room.hostId && (
                          <span className="font-medium text-amber-600">
                            👑 Host
                          </span>
                        )}

                        {player.id === socket.id && (
                          <span className="font-medium text-purple-600">
                            You
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <span className="text-sm font-semibold text-gray-400">
                    {player.score} pts
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-6 rounded-2xl border border-gray-200 bg-gray-50 p-5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-bold text-gray-900">Room Settings</h2>

                <p className="mt-1 text-xs text-gray-500">
                  Configure the game before starting
                </p>
              </div>

              {isHost && (
                <button
                  type="button"
                  onClick={() => setShowSettings((value) => !value)}
                  className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:border-purple-200 hover:bg-purple-50 hover:text-purple-600"
                >
                  {showSettings ? "Close" : "Edit Room"}
                </button>
              )}
            </div>

            {!showSettings ? (
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl border border-gray-200 bg-white p-3">
                  <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                    Rounds
                  </p>

                  <p className="mt-1 text-lg font-bold text-gray-900">
                    {room.settings.rounds}
                  </p>
                </div>

                <div className="rounded-xl border border-gray-200 bg-white p-3">
                  <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                    Time
                  </p>

                  <p className="mt-1 text-lg font-bold text-gray-900">
                    {room.settings.roundDuration} sec
                  </p>
                </div>

                <div className="rounded-xl border border-gray-200 bg-white p-3">
                  <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                    Word Pool
                  </p>

                  <p className="mt-1 text-lg font-bold capitalize text-gray-900">
                    {room.settings.wordPool}
                  </p>
                </div>
              </div>
            ) : (
              <div className="mt-5 space-y-5">
                <div>
                  <label className="text-sm font-semibold text-gray-800">
                    Number of Rounds
                  </label>

                  <select
                    value={rounds}
                    onChange={(event) => setRounds(Number(event.target.value))}
                    className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100"
                  >
                    {Array.from(
                      {
                        length: 8,
                      },
                      (_, index) => (
                        <option key={index + 1} value={index + 1}>
                          {index + 1} {index + 1 === 1 ? "Round" : "Rounds"}
                        </option>
                      ),
                    )}
                  </select>

                  <p className="mt-1 text-xs text-gray-400">
                    Each round gives one player a drawing turn.
                  </p>
                </div>

                <div>
                  <label className="text-sm font-semibold text-gray-800">
                    Time Per Round
                  </label>

                  <select
                    value={roundDuration}
                    onChange={(event) =>
                      setRoundDuration(Number(event.target.value))
                    }
                    className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100"
                  >
                    <option value={30}>30 seconds</option>

                    <option value={45}>45 seconds</option>

                    <option value={60}>60 seconds</option>

                    <option value={90}>90 seconds</option>

                    <option value={120}>120 seconds</option>
                  </select>
                </div>

                <div>
                  <label className="text-sm font-semibold text-gray-800">
                    Word Pool
                  </label>

                  <select
                    value={wordPool}
                    onChange={(event) =>
                      setWordPool(event.target.value as WordPool)
                    }
                    className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100"
                  >
                    <option value="mixed">Mixed</option>

                    <option value="animals">Animals</option>

                    <option value="food">Food</option>

                    <option value="objects">Objects</option>

                    <option value="places">Places</option>
                  </select>
                </div>

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setShowSettings(false)}
                    className="flex-1 rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-700 transition hover:bg-gray-100"
                  >
                    Cancel
                  </button>

                  <button
                    type="button"
                    onClick={saveSettings}
                    className="flex-1 rounded-xl bg-purple-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-purple-700"
                  >
                    Save Settings
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="mt-8 flex gap-3">
            {isHost && (
              <button
                onClick={handleStart}
                disabled={room.players.length < 2}
                className="flex-1 rounded-xl bg-gradient-to-r from-purple-600 to-blue-600 px-5 py-3.5 font-semibold text-white shadow-lg shadow-purple-200 transition hover:from-purple-700 hover:to-blue-700 disabled:cursor-not-allowed disabled:from-gray-300 disabled:to-gray-300 disabled:shadow-none"
              >
                {room.players.length < 2 ? "Waiting for Players" : "Start Game"}
              </button>
            )}

            <button
              onClick={handleLeave}
              className="rounded-xl border border-gray-200 bg-white px-6 py-3.5 font-semibold text-gray-700 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600"
            >
              Leave
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
