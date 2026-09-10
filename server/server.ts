import { createServer } from "http";
import { Server } from "socket.io";
import { getRandomWord, getRandomWordFromPool } from "./words";

type WordPool = "mixed" | "animals" | "food" | "objects" | "places";

type Player = {
  id: string;
  username: string;
  score: number;
};

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
  currentWord: string | null;
  drawerId: string | null;
  roundStartedAt: number | null;
  roundDuration: number;
  currentPlayerIndex: number;
  correctGuessers: string[];
  currentRound: number;
  totalRounds: number;
  settings: RoomSettings;
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

const httpServer = createServer();

const io = new Server(httpServer, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"],
  },
});

const rooms = new Map<string, Room>();

const allowedRoundDurations = [30, 45, 60, 90, 120];

const allowedWordPools: WordPool[] = [
  "mixed",
  "animals",
  "food",
  "objects",
  "places",
];

function generateRoomCode(): string {
  const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

  let code = "";

  do {
    code = "";

    for (let i = 0; i < 6; i++) {
      code += characters[Math.floor(Math.random() * characters.length)];
    }
  } while (rooms.has(code));

  return code;
}

function getPublicRoom(room: Room) {
  return {
    code: room.code,
    hostId: room.hostId,
    players: room.players,
    status: room.status,
    drawerId: room.drawerId,
    roundStartedAt: room.roundStartedAt,
    roundDuration: room.roundDuration,
    currentPlayerIndex: room.currentPlayerIndex,
    currentRound: room.currentRound,
    totalRounds: room.totalRounds,
    settings: room.settings,
  };
}

function findPlayerRoom(socketId: string): Room | undefined {
  for (const room of rooms.values()) {
    const player = room.players.find((player) => player.id === socketId);

    if (player) {
      return room;
    }
  }

  return undefined;
}

function finishGame(room: Room) {
  room.status = "finished";
  room.drawerId = null;
  room.currentWord = null;
  room.roundStartedAt = null;
  room.correctGuessers = [];

  io.to(room.code).emit("room-updated", getPublicRoom(room));

  io.to(room.code).emit("game-finished", {
    room: getPublicRoom(room),
  });

  console.log(`Game finished in ${room.code}`);
}

function startRound(room: Room) {
  if (room.players.length < 2) {
    finishGame(room);
    return;
  }

  if (room.currentRound > room.totalRounds) {
    finishGame(room);
    return;
  }

  if (room.currentPlayerIndex >= room.players.length) {
    room.currentPlayerIndex = 0;
  }

  const drawer = room.players[room.currentPlayerIndex];

  if (!drawer) {
    finishGame(room);
    return;
  }

  room.status = "playing";

  room.drawerId = drawer.id;

  room.currentWord =
    room.settings.wordPool === "mixed"
      ? getRandomWord()
      : getRandomWordFromPool(room.settings.wordPool);

  room.roundStartedAt = Date.now();

  room.roundDuration = room.settings.roundDuration;

  room.correctGuessers = [];

  const roundStartedAt = room.roundStartedAt;

  console.log(
    `Round ${room.currentRound}/${room.totalRounds} started in ${room.code}`,
  );

  console.log(`Drawer: ${drawer.username}`);

  console.log(`Word: ${room.currentWord}`);

  io.to(room.code).emit("game-started", {
    room: getPublicRoom(room),
    drawerId: room.drawerId,
    roundStartedAt,
    duration: room.roundDuration,
  });

  io.to(room.code).emit("word-length", {
    length: room.currentWord.length,
  });

  io.to(drawer.id).emit("your-word", {
    word: room.currentWord,
  });

  io.to(room.code).emit("room-updated", getPublicRoom(room));

  setTimeout(() => {
    const currentRoom = rooms.get(room.code);

    if (!currentRoom) {
      return;
    }

    if (currentRoom.status !== "playing") {
      return;
    }

    if (currentRoom.roundStartedAt !== roundStartedAt) {
      return;
    }

    endRound(currentRoom);
  }, room.roundDuration * 1000);
}

function endRound(room: Room) {
  if (room.status !== "playing") {
    return;
  }

  const endedRoundStartedAt = room.roundStartedAt;

  room.status = "finished";

  room.roundStartedAt = null;

  io.to(room.code).emit("round-ended", {
    room: getPublicRoom(room),
  });

  io.to(room.code).emit("clear-canvas");

  room.currentWord = null;

  room.drawerId = null;

  room.correctGuessers = [];

  if (room.players.length < 2) {
    finishGame(room);
    return;
  }

  const isLastPlayer = room.currentPlayerIndex >= room.players.length - 1;

  const isLastRound = room.currentRound >= room.totalRounds;

  if (isLastRound && isLastPlayer) {
    finishGame(room);
    return;
  }

  if (isLastPlayer) {
    room.currentPlayerIndex = 0;
    room.currentRound++;
  } else {
    room.currentPlayerIndex++;
  }

  io.to(room.code).emit("room-updated", getPublicRoom(room));

  setTimeout(() => {
    const currentRoom = rooms.get(room.code);

    if (!currentRoom) {
      return;
    }

    if (currentRoom.roundStartedAt !== null) {
      return;
    }

    if (currentRoom.status !== "finished") {
      return;
    }

    if (currentRoom.players.length < 2) {
      return;
    }

    if (currentRoom.currentRound > currentRoom.totalRounds) {
      finishGame(currentRoom);
      return;
    }

    if (endedRoundStartedAt === null) {
      return;
    }

    startRound(currentRoom);
  }, 1000);
}

function removePlayer(socketId: string, room: Room) {
  const playerIndex = room.players.findIndex(
    (player) => player.id === socketId,
  );

  if (playerIndex === -1) {
    return;
  }

  const leavingPlayer = room.players[playerIndex];

  const wasDrawer = room.drawerId === socketId;

  room.players.splice(playerIndex, 1);

  room.correctGuessers = room.correctGuessers.filter((id) => id !== socketId);

  if (room.players.length === 0) {
    rooms.delete(room.code);

    return;
  }

  if (room.hostId === socketId) {
    room.hostId = room.players[0].id;
  }

  if (room.status === "waiting") {
    io.to(room.code).emit("room-updated", getPublicRoom(room));

    console.log(`${leavingPlayer.username} left room ${room.code}`);

    return;
  }

  if (room.status === "finished") {
    io.to(room.code).emit("room-updated", getPublicRoom(room));

    console.log(`${leavingPlayer.username} left room ${room.code}`);

    return;
  }

  if (playerIndex < room.currentPlayerIndex) {
    room.currentPlayerIndex--;
  }

  if (room.currentPlayerIndex >= room.players.length) {
    room.currentPlayerIndex = 0;
  }

  if (wasDrawer) {
    room.drawerId = null;
    room.currentWord = null;
    room.roundStartedAt = null;
    room.correctGuessers = [];

    io.to(room.code).emit("round-ended", {
      room: getPublicRoom(room),
    });

    io.to(room.code).emit("clear-canvas");

    if (room.players.length < 2) {
      finishGame(room);

      console.log(
        `${leavingPlayer.username} left while drawing in ${room.code}`,
      );

      return;
    }

    const isLastRound = room.currentRound >= room.totalRounds;
    const isLastPlayer = playerIndex >= room.players.length;

    if (isLastRound && isLastPlayer) {
      finishGame(room);

      console.log(
        `${leavingPlayer.username} left while drawing in ${room.code}`,
      );

      return;
    }

    if (isLastPlayer) {
      room.currentPlayerIndex = 0;
      room.currentRound++;
    }

    room.status = "finished";

    io.to(room.code).emit("room-updated", getPublicRoom(room));

    setTimeout(() => {
      const currentRoom = rooms.get(room.code);

      if (!currentRoom) {
        return;
      }

      if (currentRoom.status !== "finished") {
        return;
      }

      if (currentRoom.roundStartedAt !== null) {
        return;
      }

      if (currentRoom.players.length < 2) {
        return;
      }

      if (currentRoom.currentRound > currentRoom.totalRounds) {
        finishGame(currentRoom);

        return;
      }

      startRound(currentRoom);
    }, 1000);

    console.log(`${leavingPlayer.username} left while drawing in ${room.code}`);

    return;
  }

  io.to(room.code).emit("room-updated", getPublicRoom(room));

  console.log(`${leavingPlayer.username} left room ${room.code}`);
}

io.on("connection", (socket) => {
  console.log("Player connected:", socket.id);

  socket.on("create-room", ({ username }) => {
    if (!username || !username.trim()) {
      socket.emit("error-message", "Username is required.");

      return;
    }

    const existingRoom = findPlayerRoom(socket.id);

    if (existingRoom) {
      socket.emit("room-created", getPublicRoom(existingRoom));

      return;
    }

    const roomCode = generateRoomCode();

    const player: Player = {
      id: socket.id,
      username: username.trim(),
      score: 0,
    };

    const room: Room = {
      code: roomCode,
      hostId: socket.id,
      players: [player],
      status: "waiting",
      currentWord: null,
      drawerId: null,
      roundStartedAt: null,
      roundDuration: 60,
      currentPlayerIndex: 0,
      correctGuessers: [],
      currentRound: 1,
      totalRounds: 1,
      settings: {
        rounds: 1,
        roundDuration: 60,
        wordPool: "mixed",
      },
    };

    rooms.set(roomCode, room);

    socket.join(roomCode);

    console.log(`Room ${roomCode} created by ${player.username}`);

    socket.emit("room-created", getPublicRoom(room));

    io.to(roomCode).emit("room-updated", getPublicRoom(room));
  });

  socket.on("get-room", ({ roomCode }) => {
    const code = roomCode?.trim().toUpperCase();

    const room = rooms.get(code);

    if (!room) {
      socket.emit("error-message", "Room not found.");

      return;
    }

    socket.join(code);

    socket.emit("room-updated", getPublicRoom(room));

    if (
      room.status === "playing" &&
      room.drawerId === socket.id &&
      room.currentWord
    ) {
      socket.emit("your-word", {
        word: room.currentWord,
      });
    }

    if (room.status === "playing" && room.currentWord) {
      socket.emit("word-length", {
        length: room.currentWord.length,
      });
    }
  });

  socket.on("join-room", ({ roomCode, username }) => {
    const code = roomCode?.trim().toUpperCase();

    if (!code) {
      socket.emit("error-message", "Room ID is required.");

      return;
    }

    if (!username || !username.trim()) {
      socket.emit("error-message", "Username is required.");

      return;
    }

    const room = rooms.get(code);

    if (!room) {
      socket.emit("error-message", "Room not found.");

      return;
    }

    const existingPlayer = room.players.find(
      (player) => player.id === socket.id,
    );

    if (existingPlayer) {
      socket.join(code);

      socket.emit("room-updated", getPublicRoom(room));

      return;
    }

    if (room.status !== "waiting") {
      socket.emit("error-message", "This game has already started.");

      return;
    }

    if (room.players.length >= 8) {
      socket.emit("error-message", "This room is full.");

      return;
    }

    const player: Player = {
      id: socket.id,
      username: username.trim(),
      score: 0,
    };

    room.players.push(player);

    socket.join(code);

    io.to(code).emit("room-updated", getPublicRoom(room));
  });

  socket.on(
    "update-room-settings",
    ({
      roomCode,
      rounds,
      roundDuration,
      wordPool,
    }: {
      roomCode: string;
      rounds: number;
      roundDuration: number;
      wordPool: WordPool;
    }) => {
      const code = roomCode?.trim().toUpperCase();

      const room = rooms.get(code);

      if (!room) {
        socket.emit("error-message", "Room not found.");

        return;
      }

      if (room.hostId !== socket.id) {
        socket.emit("error-message", "Only the host can edit room settings.");

        return;
      }

      if (room.status !== "waiting") {
        socket.emit(
          "error-message",
          "Room settings can only be changed before the game starts.",
        );

        return;
      }

      if (!Number.isInteger(rounds) || rounds < 1 || rounds > 8) {
        socket.emit("error-message", "Rounds must be between 1 and 8.");

        return;
      }

      if (!allowedRoundDurations.includes(roundDuration)) {
        socket.emit("error-message", "Invalid round duration.");

        return;
      }

      if (!allowedWordPools.includes(wordPool)) {
        socket.emit("error-message", "Invalid word pool.");

        return;
      }

      room.settings = {
        rounds,
        roundDuration,
        wordPool,
      };

      room.roundDuration = roundDuration;

      room.totalRounds = rounds;

      io.to(code).emit("room-updated", getPublicRoom(room));
    },
  );

  socket.on("start-game", ({ roomCode }) => {
    const code = roomCode?.trim().toUpperCase();

    const room = rooms.get(code);

    if (!room) {
      socket.emit("error-message", "Room not found.");

      return;
    }

    if (room.hostId !== socket.id) {
      socket.emit("error-message", "Only the host can start the game.");

      return;
    }

    if (room.players.length < 2) {
      socket.emit("error-message", "At least 2 players are required.");

      return;
    }

    if (room.status !== "waiting") {
      socket.emit("error-message", "The game has already started.");

      return;
    }

    room.currentPlayerIndex = 0;

    room.currentRound = 1;

    room.totalRounds = room.settings.rounds;

    room.roundDuration = room.settings.roundDuration;

    room.correctGuessers = [];

    startRound(room);
  });

  socket.on(
    "draw",
    ({
      roomCode,
      x,
      y,
      previousX,
      previousY,
      color,
      lineWidth,
      tool,
    }: DrawData & {
      roomCode: string;
    }) => {
      const code = roomCode?.trim().toUpperCase();

      const room = rooms.get(code);

      if (!room) {
        return;
      }

      if (room.status !== "playing") {
        return;
      }

      if (room.drawerId !== socket.id) {
        return;
      }

      if (
        typeof x !== "number" ||
        typeof y !== "number" ||
        typeof previousX !== "number" ||
        typeof previousY !== "number"
      ) {
        return;
      }

      if (typeof color !== "string" || !color) {
        return;
      }

      if (typeof lineWidth !== "number" || lineWidth < 1 || lineWidth > 30) {
        return;
      }

      if (tool !== "brush" && tool !== "eraser") {
        return;
      }

      socket.to(code).emit("draw", {
        x,
        y,
        previousX,
        previousY,
        color,
        lineWidth,
        tool,
      });
    },
  );

  socket.on("clear-canvas", ({ roomCode }) => {
    const code = roomCode?.trim().toUpperCase();

    const room = rooms.get(code);

    if (!room) {
      return;
    }

    if (room.status !== "playing") {
      return;
    }

    if (room.drawerId !== socket.id) {
      return;
    }

    socket.to(code).emit("clear-canvas");
  });

  socket.on("guess", ({ roomCode, guess }) => {
    const code = roomCode?.trim().toUpperCase();

    const room = rooms.get(code);

    if (!room) {
      return;
    }

    if (room.status !== "playing") {
      return;
    }

    const player = room.players.find((item) => item.id === socket.id);

    if (!player) {
      return;
    }

    if (socket.id === room.drawerId) {
      return;
    }

    if (room.correctGuessers.includes(player.id)) {
      return;
    }

    const message = String(guess ?? "").trim();

    if (!message) {
      return;
    }

    const isCorrect =
      room.currentWord !== null &&
      message.toLowerCase() === room.currentWord.toLowerCase();

    if (isCorrect) {
      room.correctGuessers.push(player.id);

      player.score += 100;

      socket.emit("chat-message", {
        id: `${Date.now()}-${socket.id}`,
        username: player.username,
        message,
        correct: true,
      });

      socket.to(code).emit("correct-guess-message", {
        username: player.username,
      });

      io.to(code).emit("correct-guess", {
        playerId: player.id,
        username: player.username,
        score: player.score,
      });

      const guessers = room.players.filter((item) => item.id !== room.drawerId);

      const allGuessersCorrect =
        guessers.length > 0 &&
        guessers.every((item) => room.correctGuessers.includes(item.id));

      if (allGuessersCorrect) {
        endRound(room);
      }

      return;
    }

    io.to(code).emit("chat-message", {
      id: `${Date.now()}-${socket.id}`,
      username: player.username,
      message,
      correct: false,
    });
  });

  socket.on("leave-room", ({ roomCode }) => {
    const code = roomCode?.trim().toUpperCase();

    const room = rooms.get(code);

    if (!room) {
      return;
    }

    removePlayer(socket.id, room);

    socket.leave(code);
  });

  socket.on("disconnect", () => {
    const room = findPlayerRoom(socket.id);

    if (!room) {
      return;
    }

    removePlayer(socket.id, room);
  });
});

const PORT = 3001;

httpServer.listen(PORT, () => {
  console.log(`Draw It server running on http://localhost:${PORT}`);
});
