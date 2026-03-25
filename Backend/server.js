require("dotenv").config();

const http = require("http");
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const compression = require("compression");
const rateLimit = require("express-rate-limit");
const mongoSanitize = require("express-mongo-sanitize");
const { initSocket } = require("./config/socket");
const { verifyToken } = require("./middleware/auth");
const errorHandler = require("./middleware/errorHandler");

// Routes
const authRoutes = require("./routes/auth");
const productRoutes = require("./routes/products");
const orderRoutes = require("./routes/orders");
const expenseRoutes = require("./routes/expenses");
const reportRoutes = require("./routes/reports");
const voucherRoutes = require("./routes/vouchers");
const kotRoutes = require("./routes/kot");
const tableRoutes = require("./routes/tables");
const customerRoutes = require("./routes/customers");
const settingsRoutes = require("./routes/settings");
const shiftRoutes = require("./routes/shifts");
const auditRoutes = require("./routes/audit");
const receiptsRoutes = require("./routes/receipts");
const discountRoutes = require("./routes/discounts");
const stockRoutes = require("./routes/stock");
const purchaseRoutes = require("./routes/purchases");

const app = express();
app.set("trust proxy", 1); // Trust first proxy (nginx)
const server = http.createServer(app);
const PORT = process.env.PORT || 5001;

// CORS — reject unauthorized origins
const allowedOrigins = [
  process.env.FRONTEND_URL,
  ...(process.env.EXTRA_ORIGINS ? process.env.EXTRA_ORIGINS.split(",") : []),
  "http://localhost:3000",
  "http://localhost:3001",
].filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, curl, server-to-server)
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      callback(new Error(`CORS: origin ${origin} not allowed`));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// Security & Middleware
app.use(helmet());
app.use(compression());
app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// Sanitize MongoDB queries — prevent NoSQL injection on body, params, and query
app.use((req, res, next) => {
  if (req.body) mongoSanitize.sanitize(req.body);
  if (req.params) mongoSanitize.sanitize(req.params);
  // Sanitize query by creating a clean copy
  if (req.query && typeof req.query === "object") {
    const cleanQuery = mongoSanitize.sanitize({ ...req.query });
    // Overwrite individual keys on the (possibly read-only) req.query
    for (const key of Object.keys(cleanQuery)) {
      req.query[key] = cleanQuery[key];
    }
  }
  next();
});

// Rate limiting — general API (increased for POS use)
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: "Too many requests, please try again later." },
});

// Rate limiting — auth endpoints (stricter)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: "Too many login attempts, please try again later." },
});

app.use("/api/auth/login", authLimiter);
app.use("/api/auth/setup", authLimiter);
app.use("/api", apiLimiter);

// MongoDB Connection
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      dbName: process.env.MONGODB_DB_NAME || "karupatti_coffee",
    });
    console.log("MongoDB connected:", mongoose.connection.host);
  } catch (err) {
    console.error("MongoDB connection failed:", err.message);
    process.exit(1);
  }
};

mongoose.connection.on("disconnected", () => {
  console.warn("MongoDB disconnected — Mongoose will auto-reconnect.");
});

// API Routes
app.use("/api/auth", authRoutes);
app.use("/api/products", productRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/expenses", expenseRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/vouchers", voucherRoutes);
app.use("/api/kot", kotRoutes);
app.use("/api/tables", tableRoutes);
app.use("/api/customers", customerRoutes);
app.use("/api/settings", settingsRoutes);
app.use("/api/shifts", shiftRoutes);
app.use("/api/audit", auditRoutes);
app.use("/api/receipts", receiptsRoutes);
app.use("/api/discounts", discountRoutes);
app.use("/api/stock", stockRoutes);
app.use("/api/purchases", purchaseRoutes);

// ImageKit Auth endpoint (singleton, requires auth)
let imagekitInstance = null;
function getImageKit() {
  if (!imagekitInstance) {
    const ImageKit = require("imagekit");
    imagekitInstance = new ImageKit({
      publicKey: process.env.IMAGEKIT_PUBLIC_KEY,
      privateKey: process.env.IMAGEKIT_PRIVATE_KEY,
      urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT,
    });
  }
  return imagekitInstance;
}

app.get("/api/auth/imagekit", verifyToken, (req, res) => {
  res.json(getImageKit().getAuthenticationParameters());
});

// Health Check
app.get("/api/health", (req, res) => {
  res.json({
    status: "healthy",
    uptime: process.uptime(),
    db: mongoose.connection.readyState === 1 ? "connected" : "disconnected",
    timestamp: new Date().toISOString(),
  });
});

app.get("/", (req, res) => {
  res.json({ message: "Karupatti Coffee API is running" });
});

// 404 Handler
app.use((req, res) => {
  res.status(404).json({ success: false, error: `Route not found: ${req.method} ${req.path}` });
});

// Global Error Handler (single handler)
app.use(errorHandler);

// Graceful Shutdown
function gracefulShutdown(signal) {
  console.log(`\n${signal} received — shutting down gracefully...`);
  server.close(() => {
    console.log("HTTP server closed.");
    mongoose.connection.close(false).then(() => {
      console.log("MongoDB connection closed.");
      process.exit(0);
    });
  });
  // Force exit after 10s
  setTimeout(() => {
    console.error("Forced shutdown after timeout.");
    process.exit(1);
  }, 10000);
}

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

// Start
connectDB().then(() => {
  initSocket(server, allowedOrigins);

  server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || "development"}`);
    console.log(`Socket.io ready`);
  });
});

module.exports = app;
