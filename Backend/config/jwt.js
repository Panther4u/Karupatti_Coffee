/**
 * Shared JWT configuration — single source of truth.
 * Fails hard at startup if JWT_SECRET is not set in production.
 */

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "24h";

if (!JWT_SECRET) {
  if (process.env.NODE_ENV === "production") {
    console.error("FATAL: JWT_SECRET environment variable is required in production.");
    process.exit(1);
  }
  console.warn("WARNING: JWT_SECRET not set — using insecure default. Set JWT_SECRET in .env for production.");
}

module.exports = {
  JWT_SECRET: JWT_SECRET || "dev_only_insecure_secret_change_me",
  JWT_EXPIRES_IN,
};
