"use client";

import { io } from "socket.io-client";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:5000";

/**
 * Singleton Socket.io client.
 * Auto-reconnects on disconnect.
 * Only initializes in the browser.
 */
let socket = null;

export function getSocket() {
  if (typeof window === "undefined") return null;

  if (!socket) {
    socket = io(API_BASE, {
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      autoConnect: true,
    });

    socket.on("connect", () => {
      console.log("Socket connected:", socket.id);
    });

    socket.on("disconnect", (reason) => {
      console.log("Socket disconnected:", reason);
      // Auto-reconnect unless the server explicitly disconnected us
      if (reason === "io server disconnect") {
        socket.connect();
      }
    });

    socket.on("connect_error", (err) => {
      console.warn("Socket connection error:", err.message);
    });
  }

  return socket;
}

export default getSocket;
