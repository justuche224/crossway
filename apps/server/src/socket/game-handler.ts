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
import { rateLimiter } from "./rate-limiter";

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
const socketToPlayer = new Map<string, string>();
const playerToSocket = new Map<string, string>();

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

  socket.on("room:join", ({ roomId, playerId, password }) => {
    const existingSocketId = playerToSocket.get(playerId);
    if (existingSocketId && existingSocketId !== socket.id) {
      const existingSocket = io.sockets.sockets.get(existingSocketId);
      if (existingSocket) {
        existingSocket.leave(roomId);
        socketToPlayer.delete(existingSocketId);
      }
    }

    socketToPlayer.set(socket.id, playerId);
    playerToSocket.set(playerId, socket.id);
    socket.data.visiblePlayerId = playerId;

    const existingRoom = roomManager.getPlayerRoom(playerId);
    if (existingRoom && existingRoom !== roomId) {
      socket.leave(existingRoom);
      const leaveResult = roomManager.leaveRoom(playerId);
      if (leaveResult && !leaveResult.roomDeleted) {
        socket.to(existingRoom).emit("room:player_left", {
          playerId,
          color: leaveResult.color,
        });
      }
    }

    const room = roomManager.getRoom(roomId);
    if (room && room.password && !password) {
      socket.emit("room:password_required");
      return;
    }

    const isNewRoom = !room;
    const clientIp = socket.data.clientIp;

    if (isNewRoom && clientIp) {
      const cooldownCheck = rateLimiter.checkRoomCreation(clientIp, true);
      if (!cooldownCheck.allowed) {
        socket.emit("room:error", {
          code: "RATE_LIMIT_ROOM_COOLDOWN",
          message: cooldownCheck.error ?? "Please wait before creating another room",
        });
        return;
      }
    }

    const result = roomManager.createOrJoinRoom(roomId, playerId, password);

    if (!result.success) {
      socket.emit("room:error", { code: result.code, message: result.error });
      return;
    }

    socket.join(roomId);
    socket.data.roomId = roomId;
    socket.data.color = result.color;

    const joinedRoom = result.room;
    const isHost = joinedRoom.hostId === playerId;

    const roomState: RoomState = {
      roomId: joinedRoom.id,
      hostId: joinedRoom.hostId,
      hasPassword: joinedRoom.password !== null,
      players: joinedRoom.players,
      gameState: joinedRoom.gameState,
      settings: joinedRoom.settings,
      yourColor: result.color,
      isHost,
    };

    socket.emit("room:joined", roomState);

    if (result.isReconnect) {
      socket.to(roomId).emit("room:player_reconnected", {
        playerId,
        color: result.color,
      });
    } else {
      socket.to(roomId).emit("room:player_joined", {
        player: { id: playerId, color: result.color, connected: true },
      });
    }

    const connectedPlayers = joinedRoom.players.filter((p) => p.connected);
    if (joinedRoom.settings.blitzEnabled && joinedRoom.gameState.status === "playing" && connectedPlayers.length === 2) {
      startBlitzTimer(io, roomId);
    }
  });

  socket.on("room:leave", () => {
    handleLeave(io, socket, false);
  });

  socket.on("game:move", ({ from, to }) => {
    const roomId = socket.data.roomId;
    const playerColor = socket.data.color;
    const playerId = socket.data.visiblePlayerId;
    const clientIp = socket.data.clientIp;

    if (!roomId || !playerColor || !playerId) {
      socket.emit("room:error", { code: "NOT_IN_ROOM", message: "Not in a room" });
      return;
    }

    if (clientIp) {
      const moveCheck = rateLimiter.checkMove(clientIp);
      if (!moveCheck.allowed) {
        socket.emit("room:error", {
          code: "RATE_LIMIT_MOVES",
          message: moveCheck.error ?? "You're making moves too quickly",
        });
        return;
      }
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
    const playerId = socket.data.visiblePlayerId;
    const clientIp = socket.data.clientIp;

    if (!roomId || !playerId) {
      socket.emit("room:error", { code: "NOT_IN_ROOM", message: "Not in a room" });
      return;
    }

    if (clientIp) {
      const eventCheck = rateLimiter.checkEvent(clientIp);
      if (!eventCheck.allowed) {
        socket.emit("room:error", {
          code: "RATE_LIMIT_EVENTS",
          message: eventCheck.error ?? "Too many requests",
        });
        return;
      }
    }

    const updated = roomManager.updateSettings(roomId, playerId, settings);
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
    const playerId = socket.data.visiblePlayerId;
    const clientIp = socket.data.clientIp;

    if (!roomId || !playerId) {
      socket.emit("room:error", { code: "NOT_IN_ROOM", message: "Not in a room" });
      return;
    }

    if (clientIp) {
      const eventCheck = rateLimiter.checkEvent(clientIp);
      if (!eventCheck.allowed) {
        socket.emit("room:error", {
          code: "RATE_LIMIT_EVENTS",
          message: eventCheck.error ?? "Too many requests",
        });
        return;
      }
    }

    const newState = roomManager.resetGame(roomId, playerId);
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
    handleLeave(io, socket, true);
  });
}

function handleLeave(io: GameServer, socket: GameSocket, isDisconnect: boolean) {
  const playerId = socket.data.visiblePlayerId;
  const roomId = socket.data.roomId;

  console.log(`Socket ${isDisconnect ? "disconnected" : "left"}: ${socket.id} (player: ${playerId})`);

  if (!playerId) {
    socketToPlayer.delete(socket.id);
    return;
  }

  socketToPlayer.delete(socket.id);

  if (isDisconnect) {
    const result = roomManager.markPlayerDisconnected(playerId, () => {
      if (roomId) {
        io.to(roomId).emit("room:player_left", {
          playerId,
          color: result?.color ?? "blue",
        });
      }
    });

    if (result && result.isGracePeriod && roomId) {
      socket.to(roomId).emit("room:player_disconnected", {
        playerId,
        color: result.color,
      });
    }
  } else {
    playerToSocket.delete(playerId);
    const result = roomManager.leaveRoom(playerId);

    if (result && !result.roomDeleted && roomId) {
      socket.to(roomId).emit("room:player_left", {
        playerId,
        color: result.color,
      });
    }

    if (result?.roomDeleted && roomId) {
      clearRoomTimer(roomId);
    }
  }
}
