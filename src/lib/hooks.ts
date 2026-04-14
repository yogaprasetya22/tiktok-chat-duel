"use client";

import { useEffect, useState } from "react";

interface ChatMessage {
  type: "chat" | "gift" | "like" | "follow" | "error" | "status";
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

interface Message {
  id: string;
  username: string;
  comment: string;
  profileImage?: string;
  type: "chat" | "gift" | "like" | "follow";
  giftName?: string;
  giftCount?: number;
  diamondCount?: number;
  timestamp: string;
}

const API_URL = typeof window !== "undefined" ? window.location.origin : "";

export const useTikTokLive = (username: string) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!username) {
      setMessages([]);
      setConnected(false);
      return;
    }

    const connectTikTok = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`${API_URL}/api/tiktok/connect`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username }),
        });

        if (!res.ok) {
          const errorData = await res.json();
          throw new Error(errorData.error || "Connection failed");
        }

        // console.log("✅ Connected to TikTok Live");
        setError(null);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Connection error";
        // console.error("🚨 Connection error:", errorMessage);
        setError(errorMessage);
        setConnected(false);
      } finally {
        setLoading(false);
      }
    };

    connectTikTok();

    // Connect to Server-Sent Events stream
    const eventSource = new EventSource(`${API_URL}/api/tiktok/events`);

    eventSource.onmessage = (event) => {
      try {
        const data: ChatMessage = JSON.parse(event.data);

        if (data.type === "status") {
          setConnected(data.connected === true);
          if (!data.connected) {
            setMessages([]);
          }
        } else if (data.type === "chat") {
          setMessages((prev) => [
            ...prev,
            {
              id: `${Date.now()}-${Math.random()}`,
              username: data.username || "Unknown",
              comment: data.comment || "",
              profileImage: data.profileImage || "",
              type: "chat" as const,
              timestamp: data.timestamp || new Date().toISOString(),
            },
          ].slice(-100));
        } else if (data.type === "gift") {
          setMessages((prev) => [
            ...prev,
            {
              id: `${Date.now()}-${Math.random()}`,
              username: data.username || "Unknown",
              comment: `🎁 sent gift: ${data.giftName} (x${data.giftCount})`,
              profileImage: data.profileImage || "",
              type: "gift" as const,
              giftName: data.giftName,
              giftCount: data.giftCount || 1,
              diamondCount: data.diamondCount || 0,
              timestamp: data.timestamp || new Date().toISOString(),
            },
          ].slice(-100));
        } else if (data.type === "like") {
          setMessages((prev) => [
            ...prev,
            {
              id: `${Date.now()}-${Math.random()}`,
              username: data.username || "Unknown",
              comment: `❤️ liked (${data.likeCount} likes)`,
              profileImage: data.profileImage || "",
              type: "like" as const,
              timestamp: data.timestamp || new Date().toISOString(),
            },
          ].slice(-100));
        } else if (data.type === "follow") {
          setMessages((prev) => [
            ...prev,
            {
              id: `${Date.now()}-${Math.random()}`,
              username: data.username || "Unknown",
              comment: "👥 followed",
              profileImage: data.profileImage || "",
              type: "follow" as const,
              timestamp: data.timestamp || new Date().toISOString(),
            },
          ].slice(-100));
        } else if (data.type === "error") {
          setError(data.message || "Backend error");
          setConnected(false);
        }
      } catch (err) {
        // console.error("❌ Event parsing error:", err);
      }
    };

    eventSource.onerror = (_error) => {
      // console.error("🚨 EventSource error:", error);
      setError("Connection lost. Reconnecting...");
      eventSource.close();
      setConnected(false);
    };

    return () => {
      eventSource.close();
    };
  }, [username]);

  const disconnect = async () => {
    try {
      await fetch(`${API_URL}/api/tiktok/disconnect`, {
        method: "POST",
      });
      setMessages([]);
      setConnected(false);
      setError(null);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Disconnect error";
      // console.error("🚨 Disconnect error:", errorMessage);
      setError(errorMessage);
    }
  };

  return {
    messages,
    connected,
    error,
    loading,
    disconnect,
  };
};
