import type { Server, Socket } from "socket.io";
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData,
  RoomState,
  GameState,
} from "@crossway/socket";
import {
  makeMove,
  makeMoveWithWarning,
  checkRepetition,
  forfeitGame,
  getRandomMove,
  getPieceOwner,
  getValidMoves,
} from "@crossway/socket";
import { roomManager } from "./room-manager";

type GameSocket = Socket<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>;

type GameServer = Server<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>;

const roomTimers = new Map<string, NodeJS.Timeout>();

function clearRoomTimer(roomId: string) {
  const timer = roomTimers.get(roomId);
  if (timer) {
    clearInterval(timer);
    roomTimers.delete(roomId);
  }
}

function startBlitzTimer(io: GameServer, roomId: string) {
  clearRoomTimer(roomId);

  const room = roomManager.getRoom(roomId);
  if (!room || !room.settings.blitzEnabled || room.gameState.status !== "playing") {
    return;
  }

  let timeLeft = room.settings.blitzTimeLimit;

  const timer = setInterval(() => {
    const currentRoom = roomManager.getRoom(roomId);
    if (!currentRoom || currentRoom.gameState.status !== "playing") {
      clearRoomTimer(roomId);
      return;
    }

    timeLeft--;
    io.to(roomId).emit("game:timer", { timeLeft });

    if (timeLeft <= 0) {
      clearRoomTimer(roomId);

      const randomMove = getRandomMove(currentRoom.gameState);
      if (randomMove) {
        const newState = makeMove(randomMove.from, randomMove.to, currentRoom.gameState);
        roomManager.updateGameState(roomId, newState);
        io.to(roomId).emit("game:state", {
          gameState: newState,
          timeLeft: currentRoom.settings.blitzTimeLimit,
        });

        if (newState.status === "playing" && currentRoom.settings.blitzEnabled) {
          startBlitzTimer(io, roomId);
        }
      }
    }
  }, 1000);

  roomTimers.set(roomId, timer);
}

export function handleSocketConnection(io: GameServer, socket: GameSocket) {
  console.log(`Socket connected: ${socket.id}`);

  socket.on("room:join", ({ roomId }) => {
    const existingRoom = roomManager.getPlayerRoom(socket.id);
    if (existingRoom && existingRoom !== roomId) {
      socket.leave(existingRoom);
      const leaveResult = roomManager.leaveRoom(socket.id);
      if (leaveResult && !leaveResult.roomDeleted) {
        socket.to(existingRoom).emit("room:player_left", {
          playerId: socket.id,
          color: leaveResult.color,
        });
      }
    }

    const result = roomManager.createOrJoinRoom(roomId, socket.id);

    if (!result.success) {
      socket.emit("room:error", { code: result.code, message: result.error });
      return;
    }

    socket.join(roomId);
    socket.data.roomId = roomId;
    socket.data.color = result.color;

    const room = result.room;
    const isHost = room.hostId === socket.id;

    const roomState: RoomState = {
      roomId: room.id,
      hostId: room.hostId,
      players: room.players,
      gameState: room.gameState,
      settings: room.settings,
      yourColor: result.color,
      isHost,
    };

    socket.emit("room:joined", roomState);

    socket.to(roomId).emit("room:player_joined", {
      player: { id: socket.id, color: result.color, connected: true },
    });

    if (room.settings.blitzEnabled && room.gameState.status === "playing" && room.players.length === 2) {
      startBlitzTimer(io, roomId);
    }
  });

  socket.on("room:leave", () => {
    handleDisconnect(io, socket);
  });

  socket.on("game:move", ({ from, to }) => {
    const roomId = socket.data.roomId;
    const playerColor = socket.data.color;

    if (!roomId || !playerColor) {
      socket.emit("room:error", { code: "NOT_IN_ROOM", message: "Not in a room" });
      return;
    }

    const room = roomManager.getRoom(roomId);
    if (!room) {
      socket.emit("room:error", { code: "ROOM_NOT_FOUND", message: "Room not found" });
      return;
    }

    if (room.gameState.status !== "playing") {
      socket.emit("room:error", { code: "GAME_OVER", message: "Game is over" });
      return;
    }

    if (room.gameState.currentPlayer !== playerColor) {
      socket.emit("room:error", { code: "NOT_YOUR_TURN", message: "Not your turn" });
      return;
    }

    const owner = getPieceOwner(from, room.gameState);
    if (owner !== playerColor) {
      socket.emit("room:error", { code: "NOT_YOUR_PIECE", message: "Not your piece" });
      return;
    }

    const validMoves = getValidMoves(from, room.gameState);
    if (!validMoves.includes(to)) {
      socket.emit("room:error", { code: "INVALID_MOVE", message: "Invalid move" });
      return;
    }

    const repetitionCheck = checkRepetition(from, to, room.gameState, room.settings.enabledRules);

    let newState: GameState;

    if (repetitionCheck.shouldForfeit) {
      newState = forfeitGame(room.gameState, playerColor);
    } else if (repetitionCheck.shouldBlock) {
      socket.emit("room:error", { code: "MOVE_BLOCKED", message: "Move blocked due to repetition" });
      return;
    } else if (repetitionCheck.shouldWarn) {
      newState = makeMoveWithWarning(from, to, room.gameState, true);
    } else {
      newState = makeMoveWithWarning(from, to, room.gameState, false);
    }

    roomManager.updateGameState(roomId, newState);

    if (room.settings.blitzEnabled && newState.status === "playing") {
      io.to(roomId).emit("game:state", {
        gameState: newState,
        timeLeft: room.settings.blitzTimeLimit,
      });
      startBlitzTimer(io, roomId);
    } else {
      clearRoomTimer(roomId);
      io.to(roomId).emit("game:state", { gameState: newState });
    }
  });

  socket.on("game:settings", (settings) => {
    const roomId = socket.data.roomId;
    if (!roomId) {
      socket.emit("room:error", { code: "NOT_IN_ROOM", message: "Not in a room" });
      return;
    }

    const updated = roomManager.updateSettings(roomId, socket.id, settings);
    if (!updated) {
      socket.emit("room:error", { code: "NOT_HOST", message: "Only the host can change settings" });
      return;
    }

    io.to(roomId).emit("game:settings", settings);

    const room = roomManager.getRoom(roomId);
    if (room && settings.blitzEnabled && room.gameState.status === "playing" && room.players.length === 2) {
      startBlitzTimer(io, roomId);
    } else if (!settings.blitzEnabled) {
      clearRoomTimer(roomId);
    }
  });

  socket.on("game:reset", () => {
    const roomId = socket.data.roomId;
    if (!roomId) {
      socket.emit("room:error", { code: "NOT_IN_ROOM", message: "Not in a room" });
      return;
    }

    const newState = roomManager.resetGame(roomId, socket.id);
    if (!newState) {
      socket.emit("room:error", { code: "NOT_HOST", message: "Only the host can reset the game" });
      return;
    }

    const room = roomManager.getRoom(roomId);
    if (room && room.settings.blitzEnabled && room.players.length === 2) {
      io.to(roomId).emit("game:state", {
        gameState: newState,
        timeLeft: room.settings.blitzTimeLimit,
      });
      startBlitzTimer(io, roomId);
    } else {
      clearRoomTimer(roomId);
      io.to(roomId).emit("game:state", { gameState: newState });
    }
  });

  socket.on("disconnect", () => {
    handleDisconnect(io, socket);
  });
}

function handleDisconnect(_io: GameServer, socket: GameSocket) {
  console.log(`Socket disconnected: ${socket.id}`);

  const result = roomManager.leaveRoom(socket.id);
  if (result && !result.roomDeleted) {
    socket.to(result.roomId).emit("room:player_left", {
      playerId: socket.id,
      color: result.color,
    });
  }

  if (result?.roomDeleted) {
    clearRoomTimer(result.roomId);
  }
}

