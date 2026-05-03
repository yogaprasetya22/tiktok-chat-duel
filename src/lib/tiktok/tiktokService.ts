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
      enableWebsocketUpgrade: false,
      processInitialData: false,
      enableExtendedGiftInfo: true,
      fetchRoomInfoOnConnect: true,
      requestOptions: {
        timeout: 10000,
      },
      clientParams: {
        app_language: 'en-US',
        device_platform: 'web',
      },
      webClientHeaders: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Referer": "https://www.tiktok.com/",
      }
    });

    this.setupListeners(cleanUsername);

    let attempts = 0;
    const maxAttempts = 3;

    while (attempts < maxAttempts) {
      try {
        await this.client.connect();
        console.log(`[TikTok] Connected to @${cleanUsername}`);
        return;
      } catch (error: any) {
        attempts++;
        console.error(`[TikTok] Connection attempt ${attempts} failed for @${cleanUsername}:`, error.message || error);
        if (attempts >= maxAttempts) {
          throw error;
        }
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
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
        profileImage: (event as any).profilePictureUrl || event.user?.profilePictureUrl,
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
        profileImage: (event as any).profilePictureUrl || event.user?.profilePictureUrl,
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
        profileImage: (event as any).profilePictureUrl || event.user?.profilePictureUrl,
        timestamp: new Date().toISOString()
      });
    });

    this.client.on("follow", (event) => {
      this.broadcast({
        type: "follow",
        username: event.uniqueId,
        profileImage: (event as any).profilePictureUrl || event.user?.profilePictureUrl,
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

  private simulationTimer: NodeJS.Timeout | null = null;

  startSimulation(config?: any, difficulty: string = "Normal") {
    if (this.simulationTimer) clearInterval(this.simulationTimer);
    
    const keyA = config?.player?.commentKeyword || "A";
    const keyB = config?.enemy?.commentKeyword || "B";

    const fakeUsers = ["Yoga_Gamer", "Kroco_Hunter", "Sultan_Tiktok", "Bocil_Kematian", "Dewa_Mage", "Windah_Fans", "Sepuh_Kroco", "Player_Pro"];
    const fakeGifts = [
      { name: "Rose", count: 1 },
      { name: "Coffee", count: 1 },
      { name: "GG", count: 1 },
      { name: "TikTok", count: 1 },
      { name: "Ice Cream Cone", count: 1 },
      { name: "Weights", count: 1 }
    ];

    console.log(`[TikTok] Starting Simulation (A: "${keyA}", B: "${keyB}", Difficulty: ${difficulty})`);
    this.currentUsername = "SIMULATE";
    this.broadcast({
      type: "status",
      connected: true,
      message: `SIMULATION ACTIVE | A: ${keyA} | B: ${keyB}`,
      timestamp: new Date().toISOString()
    });

    // Probability Configuration
    let chatThreshold = 0.9;
    let likeThreshold = 1.0;
    let intervalMs = 500; // Brutal speed for Normal
    
    if (difficulty === "Hard") {
      chatThreshold = 0.6; // 60% chat
      likeThreshold = 0.8; // 20% like, 20% gift
      intervalMs = 800;
    } else if (difficulty === "Super Hard") {
      chatThreshold = 0.3; // 30% chat
      likeThreshold = 0.5; // 20% like, 50% gift
      intervalMs = 400; // Super fast!
    } else {
      // Normal: Brutal Comments, 0% Gift
      chatThreshold = 0.9;
      likeThreshold = 1.0;
      intervalMs = 500;
    }

    this.simulationTimer = setInterval(() => {
      const rand = Math.random();
      const user = fakeUsers[Math.floor(Math.random() * fakeUsers.length)];
      
      // 50/50 Team Balance
      const isTeamA = Math.random() > 0.5;
      const teamKey = isTeamA ? keyA : keyB;

      if (rand < chatThreshold) {
        // Simulasi Chat (Balanced by teamKey)
        const teamComments = [
          teamKey,
          `${teamKey} fighter`,
          `${teamKey} mage`,
          `${teamKey} tank`,
          `${teamKey} marksman`,
          `${teamKey} assassin`
        ];
        
        this.broadcast({
          type: "chat",
          username: user,
          comment: teamComments[Math.floor(Math.random() * teamComments.length)],
          profileImage: `https://api.dicebear.com/7.x/avataaars/svg?seed=${user}`,
          timestamp: new Date().toISOString()
        });
      } else if (rand < likeThreshold) {
        // Simulasi Like
        this.broadcast({
          type: "like",
          username: user,
          likeCount: Math.floor(Math.random() * 50) + 1,
          timestamp: new Date().toISOString()
        });
      } else if (difficulty !== "Normal") {
        // Simulasi Gift
        const gift = fakeGifts[Math.floor(Math.random() * fakeGifts.length)];
        this.broadcast({
          type: "gift",
          username: user,
          giftName: gift.name,
          giftCount: gift.count,
          diamondCount: 1,
          profileImage: `https://api.dicebear.com/7.x/avataaars/svg?seed=${user}`,
          timestamp: new Date().toISOString()
        });
      }
    }, intervalMs); // Dynamic interval based on difficulty
  }

  stopSimulation() {
    if (this.simulationTimer) {
      clearInterval(this.simulationTimer);
      this.simulationTimer = null;
      this.currentUsername = null;
      console.log("[TikTok] Stopping Server-Side Simulation Mode");
      this.broadcast({
        type: "status",
        connected: false,
        message: "SIMULATION MODE STOPPED",
        timestamp: new Date().toISOString()
      });
    }
  }

  async disconnect(): Promise<void> {
    this.stopSimulation();
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

// If the existing service is missing new methods, we force a new instance
const existingService = globalForTikTok.tiktokServiceV2;
export const tiktokService = (existingService && (existingService as any).startSimulation) 
  ? existingService 
  : new TikTokLiveService();

if (process.env.NODE_ENV !== "production") {
  globalForTikTok.tiktokServiceV2 = tiktokService;
}
