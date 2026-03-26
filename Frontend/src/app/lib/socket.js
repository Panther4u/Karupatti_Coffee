"use client";

import { io } from "socket.io-client";

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || process.env.NEXT_PUBLIC_API_BASE || "http://localhost:5001";

let socket = null;

export function getSocket() {
  if (typeof window === "undefined") return null;

  if (!socket || !socket.connected) {
    // Disconnect old socket if it exists (handles hot reload)
    if (socket) {
      socket.disconnect();
      socket = null;
    }

    const token = localStorage.getItem("token");

    socket = io(SOCKET_URL, {
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      autoConnect: true,
      auth: token ? { token } : {},
    });

    socket.on("connect", () => {
      console.log("Socket connected:", socket.id);
    });

    socket.on("disconnect", (reason) => {
      console.log("Socket disconnected:", reason);
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
