/**
 * Karupatti Coffee — Centralized API Client
 * All backend calls go through here.
 * Uses JWT auth with token stored in localStorage.
 */

import { clearAuth } from "./authUtils";

const BASE_URL = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:5001";

/**
 * Base fetch helper — auto-attaches JWT token from localStorage
 * and handles 401 responses by clearing auth and redirecting.
 */
async function apiFetch(endpoint, options = {}) {
  const headers = { ...(options.headers || {}) };

  // Only set Content-Type for JSON bodies (not FormData)
  if (!(options.body instanceof FormData)) {
    headers["Content-Type"] = headers["Content-Type"] || "application/json";
  }

  if (typeof window !== "undefined") {
    const token = localStorage.getItem("token");
    if (token) headers["Authorization"] = `Bearer ${token}`;
  }

  let res;
  try {
    res = await fetch(`${BASE_URL}${endpoint}`, { ...options, headers });
  } catch (err) {
    throw new Error("Network error — check your connection");
  }

  if (res.status === 401) {
    if (typeof window !== "undefined" && !endpoint.includes("/api/auth/me")) {
      clearAuth();
      window.location.href = "/";
    }
    throw new Error("Unauthorized — session expired");
  }

  let json;
  try {
    json = await res.json();
  } catch {
    throw new Error(`Server error ${res.status} — invalid response`);
  }

  if (!res.ok) {
    throw new Error(json.error || json.message || `API error ${res.status}`);
  }

  if (json && json.success && json.data !== undefined) {
    return json.data;
  }
  return json;
}

// Auth
export const authAPI = {
  login: (username, password) =>
    apiFetch("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    }),
  me: () => apiFetch("/api/auth/me"),
  changePassword: (oldPassword, newPassword) =>
    apiFetch("/api/auth/change-password", {
      method: "POST",
      body: JSON.stringify({ oldPassword, newPassword }),
    }),
  // Staff management
  getUsers: () => apiFetch("/api/auth/users"),
  createUser: (data) => apiFetch("/api/auth/users", { method: "POST", body: JSON.stringify(data) }),
  updateUser: (id, data) => apiFetch(`/api/auth/users/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteUser: (id) => apiFetch(`/api/auth/users/${id}`, { method: "DELETE" }),
};

// Products
export const productsAPI = {
  getAll: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return apiFetch(`/api/products${query ? `?${query}` : ""}`);
  },
  getCategories: () => apiFetch("/api/products/categories"),
  getById: (id) => apiFetch(`/api/products/${id}`),
  create: (body) =>
    apiFetch("/api/products", { method: "POST", body: JSON.stringify(body) }),
  update: (id, body) =>
    apiFetch(`/api/products/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  delete: (id) => apiFetch(`/api/products/${id}`, { method: "DELETE" }),
};

// Orders
export const ordersAPI = {
  create: (orderData) =>
    apiFetch("/api/orders", { method: "POST", body: JSON.stringify(orderData) }),
  getAll: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return apiFetch(`/api/orders${query ? `?${query}` : ""}`);
  },
  getToday: () => apiFetch("/api/orders/today"),
  getById: (id) => apiFetch(`/api/orders/${id}`),
  cancel: (id) => apiFetch(`/api/orders/${id}/cancel`, { method: "PATCH" }),
};

// Expenses
export const expensesAPI = {
  getByDate: (date) => apiFetch(`/api/expenses?date=${date}`),
  create: (body) =>
    apiFetch("/api/expenses", { method: "POST", body: JSON.stringify(body) }),
  update: (id, body) =>
    apiFetch(`/api/expenses/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  delete: (id) => apiFetch(`/api/expenses/${id}`, { method: "DELETE" }),
};

// Reports
export const reportsAPI = {
  salesSummary: () => apiFetch("/api/reports/sales-summary"),
  salesSummaryByDate: (date) => apiFetch(`/api/reports/sales-summary?date=${date}`),
  daily: (date) => apiFetch(`/api/reports/daily?date=${date}`),
};

// Receipts (uses /api/orders endpoints)
export const receiptsAPI = {
  getAll: () => apiFetch("/api/orders?status=completed&limit=500"),
  create: (data) =>
    apiFetch("/api/orders", { method: "POST", body: JSON.stringify(data) }),
  update: (id, body) =>
    apiFetch(`/api/orders/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  delete: (id) => apiFetch(`/api/orders/${id}`, { method: "DELETE" }),
};

// Vouchers
export const vouchersAPI = {
  validate: (code, orderAmount) =>
    apiFetch("/api/vouchers/validate", {
      method: "POST",
      body: JSON.stringify({ code, orderAmount }),
    }),
  getAll: () => apiFetch("/api/vouchers"),
  create: (body) =>
    apiFetch("/api/vouchers", { method: "POST", body: JSON.stringify(body) }),
};

// Menu (uses /api/products endpoints)
export const menuAPI = {
  getAll: () => apiFetch("/api/products?available=true"),
  add: (body) =>
    apiFetch("/api/products", { method: "POST", body: JSON.stringify(body) }),
  update: (id, body) =>
    apiFetch(`/api/products/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  delete: (id) => apiFetch(`/api/products/${id}`, { method: "DELETE" }),
};

// KOT
export const kotAPI = {
  getActive: () => apiFetch("/api/kot/active"),
  create: (body) => apiFetch("/api/kot", { method: "POST", body: JSON.stringify(body) }),
  updateStatus: (id, body) => apiFetch(`/api/kot/${id}/status`, { method: "PATCH", body: JSON.stringify(body) }),
};

// Tables
export const tablesAPI = {
  getAll: () => apiFetch("/api/tables"),
  create: (body) => apiFetch("/api/tables", { method: "POST", body: JSON.stringify(body) }),
  setup: (body) => apiFetch("/api/tables/setup", { method: "POST", body: JSON.stringify(body) }),
  assign: (id, body) => apiFetch(`/api/tables/${id}/assign`, { method: "PATCH", body: JSON.stringify(body) }),
  release: (id) => apiFetch(`/api/tables/${id}/release`, { method: "PATCH" }),
};

// Customers
export const customersAPI = {
  search: (params) => {
    const q = new URLSearchParams(params).toString();
    return apiFetch(`/api/customers/search?${q}`);
  },
  create: (body) => apiFetch("/api/customers", { method: "POST", body: JSON.stringify(body) }),
  getById: (id) => apiFetch(`/api/customers/${id}`),
};

// Settings
export const settingsAPI = {
  get: () => apiFetch("/api/settings"),
  update: (body) => apiFetch("/api/settings", { method: "PUT", body: JSON.stringify(body) }),
};

// Shifts
export const shiftsAPI = {
  open: (body) => apiFetch("/api/shifts/open", { method: "POST", body: JSON.stringify(body) }),
  close: (body) => apiFetch("/api/shifts/close", { method: "POST", body: JSON.stringify(body) }),
  current: () => apiFetch("/api/shifts/current"),
  history: (params) => {
    const q = new URLSearchParams(params).toString();
    return apiFetch(`/api/shifts/history?${q}`);
  },
};

// Audit
export const auditAPI = {
  getAll: (params) => {
    const q = new URLSearchParams(params).toString();
    return apiFetch(`/api/audit?${q}`);
  },
};

// Receipts (public)
export const digitalReceiptAPI = {
  getPublic: async (orderId) => {
    try {
      const res = await fetch(`${BASE_URL}/api/receipts/${orderId}/public`);
      const json = await res.json();
      return json?.data ?? json;
    } catch {
      throw new Error("Failed to load receipt");
    }
  },
};

// Health
export const healthCheck = async () => {
  try {
    const res = await fetch(`${BASE_URL}/api/health`);
    return await res.json();
  } catch {
    return { status: "unreachable" };
  }
};

// Discounts
export const discountsAPI = {
  create: (body) =>
    apiFetch("/api/discounts", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  getAll: () => apiFetch("/api/discounts"),
  getActive: () => apiFetch("/api/discounts/active"),
  getApplicable: (params) => {
    const q = new URLSearchParams(params).toString();
    return apiFetch("/api/discounts/applicable?" + q);
  },
  update: (id, body) =>
    apiFetch("/api/discounts/" + id, {
      method: "PUT",
      body: JSON.stringify(body),
    }),
  delete: (id) => apiFetch("/api/discounts/" + id, { method: "DELETE" }),
};

// Stock
export const stockAPI = {
  adjust: (body) =>
    apiFetch("/api/stock/adjust", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  getLowStock: () => apiFetch("/api/stock/low"),
  getLog: (params) => {
    const q = new URLSearchParams(params).toString();
    return apiFetch("/api/stock/log?" + q);
  },
  getSummary: () => apiFetch("/api/stock/summary"),
};

// Purchases
export const purchasesAPI = {
  create: (body) =>
    apiFetch("/api/purchases", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  getAll: (params) => {
    const q = new URLSearchParams(params || {}).toString();
    return apiFetch("/api/purchases?" + q);
  },
  getById: (id) => apiFetch("/api/purchases/" + id),
  update: (id, body) =>
    apiFetch("/api/purchases/" + id, {
      method: "PUT",
      body: JSON.stringify(body),
    }),
  delete: (id) => apiFetch("/api/purchases/" + id, { method: "DELETE" }),
};

// Extended Reports
export const reportsExtAPI = {
  hourly: (date) => apiFetch("/api/reports/hourly?date=" + date),
  categoryWise: (s, e) =>
    apiFetch("/api/reports/category-wise?startDate=" + s + "&endDate=" + e),
  productPerformance: (s, e, sort, limit) =>
    apiFetch(
      "/api/reports/product-performance?startDate=" +
        s +
        "&endDate=" +
        e +
        "&sort=" +
        (sort || "qty") +
        "&limit=" +
        (limit || 10)
    ),
  paymentBreakdown: (s, e) =>
    apiFetch("/api/reports/payment-breakdown?startDate=" + s + "&endDate=" + e),
  expenseSummary: (s, e) =>
    apiFetch("/api/reports/expense-summary?startDate=" + s + "&endDate=" + e),
  customerStats: (s, e) =>
    apiFetch("/api/reports/customer-stats?startDate=" + s + "&endDate=" + e),
  comparative: (type) => apiFetch("/api/reports/comparative?type=" + type),
};

// Cash Book
export const cashbookAPI = {
  getToday: () => apiFetch("/api/cashbook/today"),
  getByDate: (date) => apiFetch(`/api/cashbook/${date}`),
  update: (date, body) => apiFetch(`/api/cashbook/${date}`, { method: "PUT", body: JSON.stringify(body) }),
  close: (date, body) => apiFetch(`/api/cashbook/${date}/close`, { method: "POST", body: JSON.stringify(body) }),
  reopen: (date) => apiFetch(`/api/cashbook/${date}/reopen`, { method: "POST" }),
  history: (params) => {
    const q = new URLSearchParams(params || {}).toString();
    return apiFetch(`/api/cashbook/history?${q}`);
  },
};
