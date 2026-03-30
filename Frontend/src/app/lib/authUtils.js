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

/**
 * Offline-safe auth check.
 * Returns user data if online and valid, or cached role from localStorage if offline.
 * Only redirects to login if there's truly no token at all.
 */
export async function offlineAuthCheck(authAPI, router) {
  const token = getToken();
  if (!token) {
    if (router) router.push("/");
    return null;
  }

  // Try online verification first
  if (navigator.onLine) {
    try {
      const user = await authAPI.me();
      return user;
    } catch {
      // Token expired — clear and redirect
      clearAuth();
      if (router) router.push("/");
      return null;
    }
  }

  // Offline — trust localStorage token
  return {
    role: typeof window !== "undefined" ? localStorage.getItem("userRole") || "cashier" : "cashier",
    username: typeof window !== "undefined" ? localStorage.getItem("userName") || "" : "",
    offline: true,
  };
}
