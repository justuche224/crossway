import type {
  Room,
  RoomPlayer,
  GameState,
  GameSettings,
  Player,
} from "@crossway/socket";
import {
  createInitialGameState,
  createDefaultSettings,
  RECONNECT_GRACE_PERIOD_MS,
} from "@crossway/socket";

export interface RoomStore {
  get(roomId: string): Room | undefined;
  set(roomId: string, room: Room): void;
  delete(roomId: string): boolean;
  size(): number;
  values(): IterableIterator<Room>;
}

class InMemoryRoomStore implements RoomStore {
  private rooms = new Map<string, Room>();

  get(roomId: string): Room | undefined {
    return this.rooms.get(roomId);
  }

  set(roomId: string, room: Room): void {
    this.rooms.set(roomId, room);
  }

  delete(roomId: string): boolean {
    return this.rooms.delete(roomId);
  }

  size(): number {
    return this.rooms.size;
  }

  values(): IterableIterator<Room> {
    return this.rooms.values();
  }
}

export type JoinResult =
  | { success: true; room: Room; color: Player; isReconnect: boolean }
  | { success: false; error: string; code: string };

export type DisconnectResult = {
  roomId: string;
  color: Player;
  roomDeleted: boolean;
  isGracePeriod: boolean;
} | null;

const disconnectTimers = new Map<string, NodeJS.Timeout>();

export class RoomManager {
  private store: RoomStore;
  private maxRooms: number;
  private playerRooms = new Map<string, string>();

  constructor(store?: RoomStore, maxRooms?: number) {
    this.store = store ?? new InMemoryRoomStore();
    this.maxRooms = maxRooms ?? parseInt(process.env.MAX_ROOMS ?? "100", 10);
  }

  canCreateRoom(): boolean {
    return this.store.size() < this.maxRooms;
  }

  getRoomCount(): number {
    return this.store.size();
  }

  getMaxRooms(): number {
    return this.maxRooms;
  }

  getRoom(roomId: string): Room | undefined {
    return this.store.get(roomId);
  }

  getPlayerRoom(playerId: string): string | undefined {
    return this.playerRooms.get(playerId);
  }

  roomRequiresPassword(roomId: string): boolean {
    const room = this.store.get(roomId);
    return room?.password !== null && room?.password !== undefined;
  }

  createOrJoinRoom(
    roomId: string,
    playerId: string,
    password?: string
  ): JoinResult {
    let room = this.store.get(roomId);

    if (room) {
      if (room.password !== null && room.password !== password) {
        return { success: false, error: "Incorrect password", code: "WRONG_PASSWORD" };
      }

      const existingPlayer = room.players.find((p) => p.id === playerId);
      if (existingPlayer) {
        const timerKey = `${roomId}:${playerId}`;
        const existingTimer = disconnectTimers.get(timerKey);
        if (existingTimer) {
          clearTimeout(existingTimer);
          disconnectTimers.delete(timerKey);
        }

        existingPlayer.connected = true;
        existingPlayer.disconnectedAt = undefined;
        this.store.set(roomId, room);
        this.playerRooms.set(playerId, roomId);
        return { success: true, room, color: existingPlayer.color, isReconnect: true };
      }

      const activePlayers = room.players.filter((p) => {
        if (p.connected) return true;
        if (p.disconnectedAt) {
          const elapsed = Date.now() - p.disconnectedAt;
          return elapsed < RECONNECT_GRACE_PERIOD_MS;
        }
        return false;
      });

      if (activePlayers.length >= 2) {
        return { success: false, error: "Room is full", code: "ROOM_FULL" };
      }

      const expiredPlayer = room.players.find((p) => {
        if (p.connected) return false;
        if (!p.disconnectedAt) return true;
        return Date.now() - p.disconnectedAt >= RECONNECT_GRACE_PERIOD_MS;
      });

      if (expiredPlayer) {
        const timerKey = `${roomId}:${expiredPlayer.id}`;
        const existingTimer = disconnectTimers.get(timerKey);
        if (existingTimer) {
          clearTimeout(existingTimer);
          disconnectTimers.delete(timerKey);
        }
        this.playerRooms.delete(expiredPlayer.id);

        expiredPlayer.id = playerId;
        expiredPlayer.connected = true;
        expiredPlayer.disconnectedAt = undefined;
        this.store.set(roomId, room);
        this.playerRooms.set(playerId, roomId);
        return { success: true, room, color: expiredPlayer.color, isReconnect: false };
      }

      const firstPlayer = room.players[0];
      const color: Player = firstPlayer?.color === "blue" ? "red" : "blue";
      const newPlayer: RoomPlayer = { id: playerId, color, connected: true };
      room.players.push(newPlayer);
      this.store.set(roomId, room);
      this.playerRooms.set(playerId, roomId);
      return { success: true, room, color, isReconnect: false };
    }

    if (!this.canCreateRoom()) {
      return {
        success: false,
        error: "Maximum room limit reached. Please try again later.",
        code: "MAX_ROOMS_REACHED",
      };
    }

    const color: Player = "blue";
    const newPlayer: RoomPlayer = { id: playerId, color, connected: true };
    const newRoom: Room = {
      id: roomId,
      hostId: playerId,
      password: password || null,
      players: [newPlayer],
      gameState: createInitialGameState(),
      settings: createDefaultSettings(),
      createdAt: Date.now(),
    };

    this.store.set(roomId, newRoom);
    this.playerRooms.set(playerId, roomId);
    return { success: true, room: newRoom, color, isReconnect: false };
  }

  markPlayerDisconnected(
    playerId: string,
    onGraceExpired?: () => void
  ): DisconnectResult {
    const roomId = this.playerRooms.get(playerId);
    if (!roomId) return null;

    const room = this.store.get(roomId);
    if (!room) {
      this.playerRooms.delete(playerId);
      return null;
    }

    const player = room.players.find((p) => p.id === playerId);
    if (!player) {
      this.playerRooms.delete(playerId);
      return null;
    }

    player.connected = false;
    player.disconnectedAt = Date.now();
    this.store.set(roomId, room);

    const timerKey = `${roomId}:${playerId}`;
    const existingTimer = disconnectTimers.get(timerKey);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    const timer = setTimeout(() => {
      disconnectTimers.delete(timerKey);
      this.finalizeDisconnect(playerId);
      onGraceExpired?.();
    }, RECONNECT_GRACE_PERIOD_MS);

    disconnectTimers.set(timerKey, timer);

    return { roomId, color: player.color, roomDeleted: false, isGracePeriod: true };
  }

  private finalizeDisconnect(playerId: string): void {
    const roomId = this.playerRooms.get(playerId);
    if (!roomId) return;

    const room = this.store.get(roomId);
    if (!room) {
      this.playerRooms.delete(playerId);
      return;
    }

    const playerIndex = room.players.findIndex((p) => p.id === playerId);
    if (playerIndex === -1) {
      this.playerRooms.delete(playerId);
      return;
    }

    room.players.splice(playerIndex, 1);
    this.playerRooms.delete(playerId);

    if (room.players.length === 0) {
      this.store.delete(roomId);
      return;
    }

    const connectedPlayers = room.players.filter((p) => p.connected);
    const firstConnected = connectedPlayers[0];
    if (room.hostId === playerId && firstConnected) {
      room.hostId = firstConnected.id;
    }

    this.store.set(roomId, room);
  }

  leaveRoom(playerId: string): DisconnectResult {
    const roomId = this.playerRooms.get(playerId);
    if (!roomId) return null;

    const timerKey = `${roomId}:${playerId}`;
    const existingTimer = disconnectTimers.get(timerKey);
    if (existingTimer) {
      clearTimeout(existingTimer);
      disconnectTimers.delete(timerKey);
    }

    const room = this.store.get(roomId);
    if (!room) {
      this.playerRooms.delete(playerId);
      return null;
    }

    const playerIndex = room.players.findIndex((p) => p.id === playerId);
    if (playerIndex === -1) {
      this.playerRooms.delete(playerId);
      return null;
    }

    const player = room.players[playerIndex];
    if (!player) {
      this.playerRooms.delete(playerId);
      return null;
    }

    const color = player.color;
    room.players.splice(playerIndex, 1);
    this.playerRooms.delete(playerId);

    if (room.players.length === 0) {
      this.store.delete(roomId);
      return { roomId, color, roomDeleted: true, isGracePeriod: false };
    }

    const connectedPlayers = room.players.filter((p) => p.connected);
    const firstConnected = connectedPlayers[0];
    if (room.hostId === playerId && firstConnected) {
      room.hostId = firstConnected.id;
    }

    this.store.set(roomId, room);
    return { roomId, color, roomDeleted: false, isGracePeriod: false };
  }

  updateGameState(roomId: string, gameState: GameState): boolean {
    const room = this.store.get(roomId);
    if (!room) return false;

    room.gameState = gameState;
    this.store.set(roomId, room);
    return true;
  }

  updateSettings(roomId: string, playerId: string, settings: GameSettings): boolean {
    const room = this.store.get(roomId);
    if (!room) return false;

    if (room.hostId !== playerId) return false;

    room.settings = settings;
    this.store.set(roomId, room);
    return true;
  }

  resetGame(roomId: string, playerId: string): GameState | null {
    const room = this.store.get(roomId);
    if (!room) return null;

    if (room.hostId !== playerId) return null;

    room.gameState = createInitialGameState();
    this.store.set(roomId, room);
    return room.gameState;
  }

  isHost(roomId: string, playerId: string): boolean {
    const room = this.store.get(roomId);
    return room?.hostId === playerId;
  }

  cleanupStaleRooms(maxAgeMs: number = 3600000): number {
    const now = Date.now();
    let cleaned = 0;

    for (const room of this.store.values()) {
      const activePlayers = room.players.filter((p) => {
        if (p.connected) return true;
        if (p.disconnectedAt) {
          return now - p.disconnectedAt < RECONNECT_GRACE_PERIOD_MS;
        }
        return false;
      });

      if (activePlayers.length === 0 && now - room.createdAt > maxAgeMs) {
        for (const player of room.players) {
          const timerKey = `${room.id}:${player.id}`;
          const timer = disconnectTimers.get(timerKey);
          if (timer) {
            clearTimeout(timer);
            disconnectTimers.delete(timerKey);
          }
          this.playerRooms.delete(player.id);
        }
        this.store.delete(room.id);
        cleaned++;
      }
    }

    return cleaned;
  }
}

export const roomManager = new RoomManager();
