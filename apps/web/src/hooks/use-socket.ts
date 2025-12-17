import { useEffect, useRef, useState, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  RoomState,
  GameState,
  GameSettings,
  Position,
  Player,
  RoomPlayer,
} from "@crossway/socket";
import { getPlayerId } from "@/utils/player-id";

type GameSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

interface UseSocketOptions {
  roomId: string;
  password?: string;
  onError?: (error: { code: string; message: string }) => void;
  onPasswordRequired?: () => void;
}

interface UseSocketReturn {
  isConnected: boolean;
  isInRoom: boolean;
  needsPassword: boolean;
  roomState: RoomState | null;
  gameState: GameState | null;
  settings: GameSettings | null;
  timeLeft: number | null;
  yourColor: Player | null;
  isHost: boolean;
  opponent: RoomPlayer | null;
  opponentDisconnected: boolean;
  joinWithPassword: (password: string) => void;
  makeMove: (from: Position, to: Position) => void;
  updateSettings: (settings: GameSettings) => void;
  resetGame: () => void;
  leaveRoom: () => void;
}

export function useSocket({
  roomId,
  password,
  onError,
  onPasswordRequired,
}: UseSocketOptions): UseSocketReturn {
  const socketRef = useRef<GameSocket | null>(null);
  const playerIdRef = useRef<string>(getPlayerId());
  const [isConnected, setIsConnected] = useState(false);
  const [isInRoom, setIsInRoom] = useState(false);
  const [needsPassword, setNeedsPassword] = useState(false);
  const [roomState, setRoomState] = useState<RoomState | null>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [settings, setSettings] = useState<GameSettings | null>(null);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [opponentDisconnected, setOpponentDisconnected] = useState(false);

  const joinRoom = useCallback((pwd?: string) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit("room:join", {
        roomId,
        playerId: playerIdRef.current,
        password: pwd,
      });
    }
  }, [roomId]);

  useEffect(() => {
    const serverUrl = import.meta.env.VITE_SERVER_URL || "http://crossway-server.jvstgames.space";
    const socket: GameSocket = io(serverUrl, {
      transports: ["websocket", "polling"],
      withCredentials: true,
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      setIsConnected(true);
      setNeedsPassword(false);
      socket.emit("room:join", {
        roomId,
        playerId: playerIdRef.current,
        password,
      });
    });

    socket.on("disconnect", () => {
      setIsConnected(false);
      setIsInRoom(false);
    });

    socket.on("room:password_required", () => {
      setNeedsPassword(true);
      onPasswordRequired?.();
    });

    socket.on("room:joined", (state) => {
      setIsInRoom(true);
      setNeedsPassword(false);
      setRoomState(state);
      setGameState(state.gameState);
      setSettings(state.settings);
      setOpponentDisconnected(false);
    });

    socket.on("room:player_joined", ({ player }) => {
      setRoomState((prev) => {
        if (!prev) return prev;
        const existingIndex = prev.players.findIndex((p) => p.id === player.id);
        const newPlayers =
          existingIndex >= 0
            ? prev.players.map((p, i) => (i === existingIndex ? player : p))
            : [...prev.players, player];
        return { ...prev, players: newPlayers };
      });
      setOpponentDisconnected(false);
    });

    socket.on("room:player_left", ({ playerId }) => {
      setRoomState((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          players: prev.players.filter((p) => p.id !== playerId),
        };
      });
      setOpponentDisconnected(false);
    });

    socket.on("room:player_disconnected", ({ playerId }) => {
      setRoomState((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          players: prev.players.map((p) =>
            p.id === playerId ? { ...p, connected: false } : p
          ),
        };
      });
      setOpponentDisconnected(true);
    });

    socket.on("room:player_reconnected", ({ playerId }) => {
      setRoomState((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          players: prev.players.map((p) =>
            p.id === playerId ? { ...p, connected: true } : p
          ),
        };
      });
      setOpponentDisconnected(false);
    });

    socket.on("room:error", (error) => {
      onError?.(error);
    });

    socket.on("game:state", ({ gameState: newState, timeLeft: newTimeLeft }) => {
      setGameState(newState);
      if (newTimeLeft !== undefined) {
        setTimeLeft(newTimeLeft);
      }
    });

    socket.on("game:settings", (newSettings) => {
      setSettings(newSettings);
    });

    socket.on("game:timer", ({ timeLeft: newTimeLeft }) => {
      setTimeLeft(newTimeLeft);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [roomId, password, onError, onPasswordRequired]);

  const joinWithPassword = useCallback(
    (pwd: string) => {
      setNeedsPassword(false);
      joinRoom(pwd);
    },
    [joinRoom]
  );

  const makeMove = useCallback((from: Position, to: Position) => {
    socketRef.current?.emit("game:move", { from, to });
  }, []);

  const updateSettings = useCallback((newSettings: GameSettings) => {
    socketRef.current?.emit("game:settings", newSettings);
  }, []);

  const resetGame = useCallback(() => {
    socketRef.current?.emit("game:reset");
  }, []);

  const leaveRoom = useCallback(() => {
    socketRef.current?.emit("room:leave");
  }, []);

  const yourColor = roomState?.yourColor ?? null;
  const isHost = roomState?.isHost ?? false;
  const opponent =
    roomState?.players.find((p) => p.color !== yourColor) ?? null;

  return {
    isConnected,
    isInRoom,
    needsPassword,
    roomState,
    gameState,
    settings,
    timeLeft,
    yourColor,
    isHost,
    opponent,
    opponentDisconnected,
    joinWithPassword,
    makeMove,
    updateSettings,
    resetGame,
    leaveRoom,
  };
}
