/**
 * Socket.io singleton — stores and exports the io instance.
 * Call initSocket(httpServer) once during startup.
 * Call getIO() from route handlers to emit events.
 */

const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");

let io = null;

/**
 * Initialize Socket.io and attach it to the given HTTP server.
 * @param {import('http').Server} server
 * @param {string[]} allowedOrigins — CORS origins for socket connections
 * @returns {import('socket.io').Server}
 */
function initSocket(server, allowedOrigins = []) {
  // Lazy-load JWT config to avoid circular dependency issues at startup
  const { JWT_SECRET } = require("./jwt");

  io = new Server(server, {
    cors: {
      origin: allowedOrigins,
      methods: ["GET", "POST"],
      credentials: true,
    },
  });

  // Socket authentication middleware
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;
    if (!token) {
      // Allow unauthenticated connections for POS display screens
      // but mark them as anonymous
      socket.user = null;
      return next();
    }
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      socket.user = decoded;
      next();
    } catch (err) {
      // Allow connection but mark as unauthenticated
      socket.user = null;
      next();
    }
  });

  io.on("connection", (socket) => {
    const user = socket.user ? socket.user.username : "anonymous";
    console.log(`Socket connected: ${socket.id} (${user})`);

    socket.on("disconnect", (reason) => {
      console.log(`Socket disconnected: ${socket.id} (${reason})`);
    });
  });

  return io;
}

/**
 * Get the current Socket.io server instance.
 * Throws if called before initSocket.
 * @returns {import('socket.io').Server}
 */
function getIO() {
  if (!io) {
    throw new Error("Socket.io not initialized — call initSocket(server) first");
  }
  return io;
}

module.exports = { initSocket, getIO };
