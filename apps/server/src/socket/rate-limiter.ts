interface RateLimitConfig {
  roomCreationCooldownMs: number;
  maxConnectionsPerIp: number;
  maxMovesPerMinute: number;
  maxEventsPerMinute: number;
}

interface IpData {
  connections: Set<string>;
  lastRoomCreation: number;
  moveTimestamps: number[];
  eventTimestamps: number[];
}

const config: RateLimitConfig = {
  roomCreationCooldownMs: parseInt(process.env.RATE_LIMIT_ROOM_COOLDOWN_MS ?? "30000", 10),
  maxConnectionsPerIp: parseInt(process.env.RATE_LIMIT_MAX_CONNECTIONS ?? "5", 10),
  maxMovesPerMinute: parseInt(process.env.RATE_LIMIT_MAX_MOVES_PER_MIN ?? "60", 10),
  maxEventsPerMinute: parseInt(process.env.RATE_LIMIT_MAX_EVENTS_PER_MIN ?? "120", 10),
};

class RateLimiter {
  private ipData = new Map<string, IpData>();
  private cleanupInterval: NodeJS.Timeout;

  constructor() {
    this.cleanupInterval = setInterval(() => this.cleanup(), 60000);
  }

  private getOrCreateIpData(ip: string): IpData {
    let data = this.ipData.get(ip);
    if (!data) {
      data = {
        connections: new Set(),
        lastRoomCreation: 0,
        moveTimestamps: [],
        eventTimestamps: [],
      };
      this.ipData.set(ip, data);
    }
    return data;
  }

  addConnection(ip: string, socketId: string): { allowed: boolean; error?: string } {
    const data = this.getOrCreateIpData(ip);

    if (data.connections.size >= config.maxConnectionsPerIp) {
      return {
        allowed: false,
        error: `Too many connections from your IP (max ${config.maxConnectionsPerIp})`,
      };
    }

    data.connections.add(socketId);
    return { allowed: true };
  }

  removeConnection(ip: string, socketId: string): void {
    const data = this.ipData.get(ip);
    if (data) {
      data.connections.delete(socketId);
      if (data.connections.size === 0 && this.isIpDataEmpty(data)) {
        this.ipData.delete(ip);
      }
    }
  }

  checkRoomCreation(ip: string, isNewRoom: boolean): { allowed: boolean; error?: string; waitMs?: number } {
    if (!isNewRoom) {
      return { allowed: true };
    }

    const data = this.getOrCreateIpData(ip);
    const now = Date.now();
    const elapsed = now - data.lastRoomCreation;

    if (elapsed < config.roomCreationCooldownMs) {
      const waitMs = config.roomCreationCooldownMs - elapsed;
      return {
        allowed: false,
        error: `Please wait ${Math.ceil(waitMs / 1000)} seconds before creating another room`,
        waitMs,
      };
    }

    data.lastRoomCreation = now;
    return { allowed: true };
  }

  checkMove(ip: string): { allowed: boolean; error?: string } {
    const data = this.getOrCreateIpData(ip);
    const now = Date.now();
    const oneMinuteAgo = now - 60000;

    data.moveTimestamps = data.moveTimestamps.filter((t) => t > oneMinuteAgo);

    if (data.moveTimestamps.length >= config.maxMovesPerMinute) {
      return {
        allowed: false,
        error: "You're making moves too quickly. Please slow down.",
      };
    }

    data.moveTimestamps.push(now);
    return { allowed: true };
  }

  checkEvent(ip: string): { allowed: boolean; error?: string } {
    const data = this.getOrCreateIpData(ip);
    const now = Date.now();
    const oneMinuteAgo = now - 60000;

    data.eventTimestamps = data.eventTimestamps.filter((t) => t > oneMinuteAgo);

    if (data.eventTimestamps.length >= config.maxEventsPerMinute) {
      return {
        allowed: false,
        error: "Too many requests. Please slow down.",
      };
    }

    data.eventTimestamps.push(now);
    return { allowed: true };
  }

  private isIpDataEmpty(data: IpData): boolean {
    return (
      data.connections.size === 0 &&
      data.lastRoomCreation === 0 &&
      data.moveTimestamps.length === 0 &&
      data.eventTimestamps.length === 0
    );
  }

  private cleanup(): void {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;
    const cooldownThreshold = now - config.roomCreationCooldownMs;

    for (const [ip, data] of this.ipData.entries()) {
      data.moveTimestamps = data.moveTimestamps.filter((t) => t > oneMinuteAgo);
      data.eventTimestamps = data.eventTimestamps.filter((t) => t > oneMinuteAgo);

      if (data.lastRoomCreation < cooldownThreshold) {
        data.lastRoomCreation = 0;
      }

      if (this.isIpDataEmpty(data)) {
        this.ipData.delete(ip);
      }
    }
  }

  getConfig(): RateLimitConfig {
    return { ...config };
  }

  getStats(): { totalIps: number; totalConnections: number } {
    let totalConnections = 0;
    for (const data of this.ipData.values()) {
      totalConnections += data.connections.size;
    }
    return {
      totalIps: this.ipData.size,
      totalConnections,
    };
  }

  destroy(): void {
    clearInterval(this.cleanupInterval);
  }
}

export const rateLimiter = new RateLimiter();

