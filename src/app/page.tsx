"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { socket } from "@/lib/socket";

type Room = {
  code: string;
  hostId: string;
  players: {
    id: string;
    username: string;
    score: number;
  }[];
  status: "waiting" | "playing" | "finished";
};

export default function Home() {
  const router = useRouter();

  const [username, setUsername] = useState("");
  const [roomId, setRoomId] = useState("");
  const [loading, setLoading] = useState(false);

  // --------------------------------------------------
  // SOCKET CONNECTION
  // --------------------------------------------------

  useEffect(() => {
    function handleConnectError() {
      setLoading(false);

      alert(
        "Unable to connect to the game server. Make sure the server is running.",
      );
    }

    socket.on("connect_error", handleConnectError);

    return () => {
      socket.off("connect_error", handleConnectError);
    };
  }, []);

  // --------------------------------------------------
  // CREATE GAME
  // --------------------------------------------------

  function createGame() {
    const playerName = username.trim();

    if (!playerName) {
      alert("Please enter your username.");
      return;
    }

    if (playerName.length < 2) {
      alert("Username must be at least 2 characters.");
      return;
    }

    setLoading(true);

    localStorage.setItem("username", playerName);
    localStorage.setItem("roomAction", "create");

    socket.off("room-created");
    socket.off("error-message");

    const handleRoomCreated = (room: Room) => {
      console.log("ROOM CREATED:", room);

      // Save the complete room for the lobby
      sessionStorage.setItem("draw-it-room", JSON.stringify(room));

      console.log("ROOM SAVED TO SESSION:", room);

      router.push(`/lobby/${room.code}`);
    };

    const handleError = (message: string) => {
      console.error("CREATE ROOM ERROR:", message);

      setLoading(false);
      alert(message);

      socket.off("room-created", handleRoomCreated);
      socket.off("error-message", handleError);
    };

    socket.once("room-created", handleRoomCreated);
    socket.once("error-message", handleError);

    function create() {
      console.log("Creating room...");
      console.log("Socket ID:", socket.id);

      socket.emit("create-room", {
        username: playerName,
      });
    }

    if (socket.connected) {
      create();
    } else {
      console.log("Connecting to server...");

      socket.once("connect", create);
      socket.connect();
    }
  }

  // --------------------------------------------------
  // JOIN GAME
  // --------------------------------------------------

  function joinGame() {
    const playerName = username.trim();
    const code = roomId.trim().toUpperCase();

    if (!playerName) {
      alert("Please enter your username.");
      return;
    }

    if (playerName.length < 2) {
      alert("Username must be at least 2 characters.");
      return;
    }

    if (!code) {
      alert("Please enter a Room ID.");
      return;
    }

    if (code.length !== 6) {
      alert("Room ID must be 6 characters.");
      return;
    }

    setLoading(true);

    // Save information for the lobby
    localStorage.setItem("username", playerName);
    localStorage.setItem("roomAction", "join");

    // Connect socket if needed
    if (!socket.connected) {
      socket.connect();
    }

    // The lobby will actually send join-room.
    router.push(`/lobby/${code}`);
  }

  // --------------------------------------------------
  // INPUT VALIDATION
  // --------------------------------------------------

  const usernameValid = username.trim().length >= 2;

  const roomValid = roomId.trim().length === 6;

  // --------------------------------------------------
  // UI
  // --------------------------------------------------

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-12">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-purple-500 to-blue-500 text-4xl">
            🎨
          </div>

          <h1 className="text-5xl font-extrabold tracking-tight">Draw It</h1>

          <p className="mx-auto mt-4 max-w-sm text-base leading-7">
            A multiplayer drawing game where players draw, guess, and compete
            for the highest score.
          </p>
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-gray-200 bg-white p-7">
          <div className="mb-6">
            <h2 className="text-xl font-bold text-gray-900">Play a Game</h2>

            <p className="mt-1 text-sm text-gray-500">
              Create a new room or join your friends.
            </p>
          </div>

          <div className="flex flex-col gap-5">
            {/* Username */}
            <div className="flex flex-col gap-2">
              <label
                htmlFor="username"
                className="text-sm font-semibold text-gray-800"
              >
                Username
              </label>

              <input
                id="username"
                type="text"
                value={username}
                maxLength={20}
                disabled={loading}
                placeholder="Enter your username"
                onChange={(event) => setUsername(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && usernameValid && roomValid) {
                    joinGame();
                  }
                }}
                className="w-full rounded-xl border border-gray-300 bg-gray-50 px-4 py-3 text-gray-900 placeholder:text-gray-400 outline-none transition focus:border-purple-500 focus:bg-white focus:ring-4 focus:ring-purple-100 disabled:cursor-not-allowed disabled:opacity-60"
              />

              <div className="flex justify-end">
                <span className="text-xs text-gray-400">
                  {username.length}/20
                </span>
              </div>
            </div>

            {/* Room ID */}
            <div className="flex flex-col gap-2">
              <label
                htmlFor="roomId"
                className="text-sm font-semibold text-gray-800"
              >
                Room ID
                <span className="ml-2 font-normal text-gray-400">
                  Optional when creating
                </span>
              </label>

              <input
                id="roomId"
                type="text"
                value={roomId}
                maxLength={6}
                disabled={loading}
                placeholder="Enter room ID"
                onChange={(event) =>
                  setRoomId(
                    event.target.value
                      .replace(/[^a-zA-Z0-9]/g, "")
                      .toUpperCase(),
                  )
                }
                className="w-full rounded-xl border border-gray-300 bg-gray-50 px-4 py-3 uppercase tracking-widest text-gray-900 placeholder:normal-case placeholder:tracking-normal placeholder:text-gray-400 outline-none transition focus:border-purple-500 focus:bg-white focus:ring-4 focus:ring-purple-100 disabled:cursor-not-allowed disabled:opacity-60"
              />

              <div className="flex justify-end">
                <span className="text-xs text-gray-400">{roomId.length}/6</span>
              </div>
            </div>

            {/* Join */}
            <button
              onClick={joinGame}
              disabled={!usernameValid || !roomValid || loading}
              className="w-full rounded-xl bg-blue-500 px-4 py-3.5 font-semibold text-white shadow-md shadow-blue-200 transition hover:bg-blue-600 hover:shadow-lg disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-400 disabled:shadow-none"
            >
              {loading ? "Joining..." : "Join Game"}
            </button>

            {/* Divider */}
            <div className="flex items-center gap-4">
              <div className="h-px flex-1 bg-gray-200" />

              <span className="text-xs font-medium text-gray-400">OR</span>

              <div className="h-px flex-1 bg-gray-200" />
            </div>

            {/* Create */}
            <button
              onClick={createGame}
              disabled={!usernameValid || loading}
              className="w-full rounded-xl bg-green-500 px-4 py-3.5 font-semibold text-white shadow-md shadow-green-200 transition hover:bg-green-600 hover:shadow-lg disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-400 disabled:shadow-none"
            >
              {loading ? "Creating..." : "Create Game"}
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-6 text-center">
          <p className="text-xs text-gray-400">Draw • Guess • Compete</p>
        </div>
      </div>
    </main>
  );
}
