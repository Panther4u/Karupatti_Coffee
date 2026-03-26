/**
 * Shared auth utilities — login/logout/check.
 */

const AUTH_KEYS = ["token", "isAdmin", "adminLoginTime", "userRole"];

/** Clear all auth data from localStorage */
export function clearAuth() {
  if (typeof window === "undefined") return;
  AUTH_KEYS.forEach((k) => localStorage.removeItem(k));
}

/** Get stored JWT token */
export function getToken() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("token");
}

/** Check if user is authenticated (token exists) */
export function isAuthenticated() {
  return !!getToken();
}

/** Perform full logout — clear storage and redirect */
export function logout() {
  clearAuth();
  if (typeof window !== "undefined") window.location.href = "/";
}
