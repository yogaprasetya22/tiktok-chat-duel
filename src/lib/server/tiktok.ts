import { TikTokLive } from "@tiktool/live";

interface ChatMessage {
  type: "chat" | "gift" | "like" | "follow" | "error" | "status";
  username?: string;
  comment?: string;
  profileImage?: string;
  giftName?: string;
  giftCount?: number;
  likeCount?: number;
  message?: string;
  connected?: boolean;
  timestamp?: string;
}

class TikTokLiveService {
  private client: any = null;
  private currentUsername: string | null = null;
  private clients: Set<ReadableStreamDefaultController<any>> = new Set();
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  private reconnectDelay: number = 2000;
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private lastEventTimestamp: number = 0;

  addClient(controller: ReadableStreamDefaultController<any>) {
    this.clients.add(controller);
    return () => this.clients.delete(controller);
  }

  private broadcast(message: ChatMessage) {
    const data = `data: ${JSON.stringify(message)}\n\n`;
    this.clients.forEach((client) => {
      try {
        client.enqueue(data);
      } catch (error) {
        this.clients.delete(client);
      }
    });
  }

  private startHealthCheck(username: string) {
    // Clear existing interval
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    // Check connection health every 10 seconds
    this.healthCheckInterval = setInterval(async () => {
      const timeSinceLastEvent = Date.now() - this.lastEventTimestamp;
      
      // If no events for 30+ seconds, try to reconnect
      if (timeSinceLastEvent > 30000 && this.client) {
        console.warn("🔄 No events for 30s, attempting reconnection...");
        await this.reconnect(username);
      }
    }, 10000);
  }

  private stopHealthCheck() {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
  }

  async reconnect(username: string): Promise<void> {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      const errorMsg = `Failed to reconnect after ${this.maxReconnectAttempts} attempts`;
      console.error(`❌ ${errorMsg}`);
      this.broadcast({
        type: "error",
        message: errorMsg,
        timestamp: new Date().toISOString(),
      });
      this.reconnectAttempts = 0;
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(1.5, this.reconnectAttempts - 1);
    
    console.log(`🔄 Reconnection attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms...`);
    
    this.broadcast({
      type: "error",
      message: `Reconnecting (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})...`,
      timestamp: new Date().toISOString(),
    });

    setTimeout(() => {
      this.connect(username).catch((err) => {
        console.error("Reconnection failed:", err);
      });
    }, delay);
  }

  async connect(username: string): Promise<void> {
    if (this.client) {
      await this.disconnect();
    }

    try {
      const apiKey = process.env.VITE_TIKTOK_API_KEY;
      if (!apiKey) {
        throw new Error("API Key not configured. Set VITE_TIKTOK_API_KEY in .env.local");
      }

      console.log(`🔗 Connecting to TikTok Live @${username}...`);
      
      this.client = new TikTokLive({
        uniqueId: username,
        apiKey,
      });

      this.client.on("connect", () => {
        console.log(`✅ Connected to @${username}`);
        this.currentUsername = username;
        this.reconnectAttempts = 0; // Reset on successful connection
        this.lastEventTimestamp = Date.now();
        this.startHealthCheck(username);
        this.broadcast({
          type: "status",
          connected: true,
          username,
          timestamp: new Date().toISOString(),
        });
      });

      this.client.on("chat", (event: any) => {
        this.lastEventTimestamp = Date.now();
        const username = event.uniqueId || event.user?.uniqueId || event.username || "Anonymous";
        const profileImage = event.user?.avatar || event.profileImage || event.avatar || event.userAvatar || "";

        this.broadcast({
          type: "chat",
          username,
          comment: event.comment,
          profileImage,
          timestamp: new Date().toISOString(),
        });
      });

      this.client.on("gift", (event: any) => {
        this.lastEventTimestamp = Date.now();
        const username = event.uniqueId || event.user?.uniqueId || event.username || "Anonymous";
        const profileImage = event.user?.avatar || event.profileImage || event.avatar || event.userAvatar || "";
        console.log(`🎁 ${username} sent ${event.giftName}`);
        this.broadcast({
          type: "gift",
          username,
          profileImage,
          giftName: event.giftName || "Unknown Gift",
          giftCount: event.giftCount || 1,
          timestamp: new Date().toISOString(),
        });
      });

      this.client.on("like", (event: any) => {
        this.lastEventTimestamp = Date.now();
        const username = event.uniqueId || event.user?.uniqueId || event.username || "Anonymous";
        const profileImage = event.user?.avatar || event.profileImage || event.avatar || event.userAvatar || "";
        this.broadcast({
          type: "like",
          username,
          profileImage,
          likeCount: event.likeCount || 1,
          timestamp: new Date().toISOString(),
        });
      });

      this.client.on("follow", (event: any) => {
        this.lastEventTimestamp = Date.now();
        const username = event.uniqueId || event.user?.uniqueId || event.username || "Anonymous";
        const profileImage = event.user?.avatar || event.profileImage || event.avatar || event.userAvatar || "";
        this.broadcast({
          type: "follow",
          username,
          profileImage,
          timestamp: new Date().toISOString(),
        });
      });

      this.client.on("disconnect", () => {
        console.log(`❌ Disconnected from @${username}`);
        this.stopHealthCheck();
        this.currentUsername = null;
        this.broadcast({
          type: "status",
          connected: false,
          username,
          timestamp: new Date().toISOString(),
        });
      });

      this.client.on("error", (err: any) => {
        this.lastEventTimestamp = Date.now();
        const errorMsg = err?.message || err?.toString() || "Unknown error";
        console.error("🚨 TikTok Error:", errorMsg);
        this.broadcast({
          type: "error",
          message: errorMsg,
          timestamp: new Date().toISOString(),
        });
        // Try to reconnect on error
        this.reconnect(username).catch(() => {});
      });

      await this.client.connect();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Connection failed";
      console.error("Connection error:", errorMessage);
      this.broadcast({
        type: "error",
        message: errorMessage,
        timestamp: new Date().toISOString(),
      });
      // Attempt to reconnect
      await this.reconnect(username);
    }
  }

  async disconnect(): Promise<void> {
    this.stopHealthCheck();
    if (this.client) {
      try {
        this.client.disconnect();
      } catch (error) {
        console.error("Disconnect error:", error);
      }
      this.client = null;
      this.currentUsername = null;
    }
  }

  isConnected(): boolean {
    return !!this.client && this.currentUsername !== null;
  }

  getCurrentUsername(): string | null {
    return this.currentUsername;
  }

  // Get connection health status
  getHealthStatus() {
    return {
      connected: this.isConnected(),
      username: this.currentUsername,
      lastEventAge: Date.now() - this.lastEventTimestamp,
      reconnectAttempts: this.reconnectAttempts,
    };
  }
}

// Singleton instance
export const tiktokService = new TikTokLiveService();
