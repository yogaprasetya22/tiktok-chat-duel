import { WebcastPushConnection } from "tiktok-live-connector";


interface ChatMessage {
  type: "chat" | "gift" | "like" | "follow" | "error" | "status" | "heartbeat";
  username?: string;
  comment?: string;
  profileImage?: string;
  giftName?: string;
  giftCount?: number;
  diamondCount?: number;
  likeCount?: number;
  message?: string;
  connected?: boolean;
  timestamp?: string;
}

const MAX_POOL_SIZE = 500;
const EVENT_THROTTLE_MS = 100; // Throttle per event type per user

class TikTokLiveService {
  private client: WebcastPushConnection | null = null;
  private currentUsername: string | null = null;
  private clients: Set<ReadableStreamDefaultController<any>> = new Set();
  private eventThrottleMap = new Map<string, number>();
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private messagePool: string[] = [];

  constructor() {
    this.startHeartbeat();
  }

  private startHeartbeat() {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    this.heartbeatTimer = setInterval(() => {
      this.broadcast({
        type: "heartbeat",
        timestamp: new Date().toISOString()
      }, true); // Silent heartbeat, don't pool
    }, 30000);
  }

  addClient(controller: ReadableStreamDefaultController<any>) {
    this.clients.add(controller);
    
    // Catch them up with recent history (optional but good for UX)
    this.messagePool.forEach(msg => {
      try { controller.enqueue(msg); } catch (e) {}
    });

    return () => this.clients.delete(controller);
  }

  private broadcast(message: ChatMessage, skipPool = false) {
    const data = `data: ${JSON.stringify(message)}\n\n`;
    
    // Add to pool for new clients
    if (!skipPool && message.type !== "status" && message.type !== "error") {
      this.messagePool.push(data);
      if (this.messagePool.length > MAX_POOL_SIZE) {
        this.messagePool.shift();
      }
    }

    const toRemove: Set<ReadableStreamDefaultController<any>> = new Set();
    this.clients.forEach((client) => {
      try {
        client.enqueue(data);
      } catch {
        toRemove.add(client);
      }
    });
    toRemove.forEach(c => this.clients.delete(c));
  }

  private shouldThrottle(eventKey: string): boolean {
    const now = Date.now();
    const lastTime = this.eventThrottleMap.get(eventKey) || 0;
    if (now - lastTime < EVENT_THROTTLE_MS) return true;
    this.eventThrottleMap.set(eventKey, now);
    
    // Cleanup throttle map occasionally
    if (this.eventThrottleMap.size > 200) {
      const oldest = Array.from(this.eventThrottleMap.entries())[0][0];
      this.eventThrottleMap.delete(oldest);
    }
    return false;
  }

  async connect(username: string): Promise<void> {
    if (!username) throw new Error("Username is required");
    let cleanUsername = username.trim();
    if (cleanUsername.startsWith("@")) cleanUsername = cleanUsername.slice(1);

    if (this.client) {
      await this.disconnect();
    }

    this.client = new WebcastPushConnection(cleanUsername, {
      enableWebsocketUpgrade: true,
      processInitialData: false,
      enableExtendedGiftInfo: true,
      fetchRoomInfoOnConnect: true,
      // Use the provided EulerStream API Key to bypass rate limits
      apiKey: process.env.TIKTOK_API_KEY,
      webClientHeaders: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      }
    });

    this.setupListeners(cleanUsername);

    try {
      await this.client.connect();
      console.log(`[TikTok] Connected to @${cleanUsername}`);
    } catch (error) {
      console.error(`[TikTok] Connection error for @${cleanUsername}:`, error);
      throw error;
    }
  }

  private setupListeners(targetUsername: string) {
    if (!this.client) return;

    this.client.on("connect", () => {
      this.currentUsername = targetUsername;
      this.broadcast({
        type: "status",
        connected: true,
        username: targetUsername,
        timestamp: new Date().toISOString()
      });
    });

    this.client.on("chat", (event) => {
      const user = event.uniqueId || "Anonymous";
      const key = `chat:${user}`;
      if (this.shouldThrottle(key)) return;

      this.broadcast({
        type: "chat",
        username: user,
        comment: event.comment,
        profileImage: event.user?.profilePictureUrl,
        timestamp: new Date().toISOString()
      });
    });

    this.client.on("gift", (event) => {
      // Gifts are high priority, less throttling or specific logic
      this.broadcast({
        type: "gift",
        username: event.uniqueId,
        giftName: event.giftName,
        giftCount: event.repeatCount || 1,
        diamondCount: (event.diamondCount || 0) * (event.repeatCount || 1),
        profileImage: event.user?.profilePictureUrl,
        timestamp: new Date().toISOString()
      });
    });

    this.client.on("like", (event) => {
      const user = event.uniqueId || "Anonymous";
      const key = `like:${user}`;
      if (this.shouldThrottle(key)) return;

      this.broadcast({
        type: "like",
        username: user,
        likeCount: event.likeCount || 1,
        profileImage: event.user?.profilePictureUrl,
        timestamp: new Date().toISOString()
      });
    });

    this.client.on("follow", (event) => {
      this.broadcast({
        type: "follow",
        username: event.uniqueId,
        profileImage: event.user?.profilePictureUrl,
        timestamp: new Date().toISOString()
      });
    });

    this.client.on("disconnect", () => {
      console.log(`[TikTok] Disconnected from @${targetUsername}`);
      this.currentUsername = null;
      this.client = null;
      this.broadcast({
        type: "status",
        connected: false,
        username: targetUsername,
        timestamp: new Date().toISOString()
      });
    });

    this.client.on("error", (err) => {
      this.broadcast({
        type: "error",
        message: err?.toString() || "Stream Error",
        timestamp: new Date().toISOString()
      });
    });
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      try {
        await this.client.disconnect();
      } catch (e) {}
      this.client = null;
      this.currentUsername = null;
    }
  }

  isConnected(): boolean {
    return !!this.client && this.currentUsername !== null;
  }

  getCurrentUsername() {
    return this.currentUsername;
  }
}

// Global Singleton Pattern for Next.js HMR stability
const globalForTikTok = global as unknown as { tiktokServiceV2: TikTokLiveService };
export const tiktokService = globalForTikTok.tiktokServiceV2 || new TikTokLiveService();

if (process.env.NODE_ENV !== "production") {
  globalForTikTok.tiktokServiceV2 = tiktokService;
}
