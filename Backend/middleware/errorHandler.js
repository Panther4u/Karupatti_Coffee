module.exports = (err, req, res, next) => {
  const timestamp = new Date().toISOString();
  const statusCode = err.statusCode || err.status || 500;

  console.error(`[${timestamp}] Error ${statusCode} — ${req.method} ${req.originalUrl}`);
  console.error(`  Message: ${err.message}`);
  if (process.env.NODE_ENV !== "production") {
    console.error(`  Stack: ${err.stack}`);
  }

  // CORS errors
  if (err.message?.includes("CORS")) {
    return res.status(403).json({ success: false, error: err.message });
  }

  // Mongoose validation errors
  if (err.name === "ValidationError") {
    const msgs = Object.values(err.errors).map((e) => e.message);
    return res.status(400).json({ success: false, error: msgs.join(", ") });
  }

  // Mongoose duplicate key error
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || "field";
    return res.status(409).json({ success: false, error: field + " already exists" });
  }

  // JWT errors
  if (err.name === "JsonWebTokenError") {
    return res.status(401).json({ success: false, error: "Invalid token" });
  }

  if (err.name === "TokenExpiredError") {
    return res.status(401).json({ success: false, error: "Token expired" });
  }

  // Mongoose CastError (invalid ObjectId)
  if (err.name === "CastError") {
    return res.status(400).json({ success: false, error: "Invalid ID format" });
  }

  // Default
  res.status(statusCode).json({
    success: false,
    error:
      process.env.NODE_ENV === "production"
        ? "Internal server error"
        : err.message || "Internal server error",
  });
};
