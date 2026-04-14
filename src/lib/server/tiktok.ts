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

  async connect(username: string): Promise<void> {
    if (this.client) {
      await this.disconnect();
    }

    try {
      const apiKey = process.env.VITE_TIKTOK_API_KEY;
      if (!apiKey) {
        throw new Error("API Key not configured. Set VITE_TIKTOK_API_KEY in .env.local");
      }

      // console.log(`🔗 Connecting to TikTok Live @${username}...`);
      
      this.client = new TikTokLive({
        uniqueId: username,
        apiKey,
      });

      this.client.on("connect", () => {
        // console.log(`✅ Connected to @${username}`);
        this.currentUsername = username;
        this.broadcast({
          type: "status",
          connected: true,
          username,
          timestamp: new Date().toISOString(),
        });
      });

      this.client.on("chat", (event: any) => {
        const username = event.uniqueId || event.user?.uniqueId || event.username || "Anonymous";
        const profileImage = event.user?.avatar || event.profileImage || event.avatar || event.userAvatar || "";

        // console.log(`💬 ${username}: ${event.comment}`, JSON.stringify(logEvent, null, 2));
        this.broadcast({
          type: "chat",
          username,
          comment: event.comment,
          profileImage,
          timestamp: new Date().toISOString(),
        });
      });

      this.client.on("gift", (event: any) => {
        const username = event.uniqueId || event.user?.uniqueId || event.username || "Anonymous";
        const profileImage = event.user?.avatar || event.profileImage || event.avatar || event.userAvatar || "";
        // console.log(`🎁 ${username} sent ${event.giftName} - Image: ${profileImage}`);
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
        const username = event.uniqueId || event.user?.uniqueId || event.username || "Anonymous";
        const profileImage = event.user?.avatar || event.profileImage || event.avatar || event.userAvatar || "";
        // console.log(`❤️ ${username} liked - Image: ${profileImage}`);
        this.broadcast({
          type: "like",
          username,
          profileImage,
          likeCount: event.likeCount || 1,
          timestamp: new Date().toISOString(),
        });
      });

      this.client.on("follow", (event: any) => {
        const username = event.uniqueId || event.user?.uniqueId || event.username || "Anonymous";
        const profileImage = event.user?.avatar || event.profileImage || event.avatar || event.userAvatar || "";
        // console.log(`👥 ${username} followed - Image: ${profileImage}`);
        this.broadcast({
          type: "follow",
          username,
          profileImage,
          timestamp: new Date().toISOString(),
        });
      });

      this.client.on("disconnect", () => {
        // console.log(`❌ Disconnected from @${username}`);
        this.currentUsername = null;
        this.broadcast({
          type: "status",
          connected: false,
          username,
          timestamp: new Date().toISOString(),
        });
      });

      this.client.on("error", (err: any) => {
        const errorMsg = err?.message || err?.toString() || "Unknown error";
        // console.error("🚨 TikTok Error:", errorMsg);
        this.broadcast({
          type: "error",
          message: errorMsg,
          timestamp: new Date().toISOString(),
        });
      });

      await this.client.connect();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Connection failed";
      // console.error("Connection error:", errorMessage);
      this.broadcast({
        type: "error",
        message: errorMessage,
        timestamp: new Date().toISOString(),
      });
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      try {
        this.client.disconnect();
      } catch (error) {
        // console.error("Disconnect error:", error);
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
}

// Singleton instance
export const tiktokService = new TikTokLiveService();
