const DB_NAME = "karupatti-offline";
const DB_VERSION = 2;
const ORDER_STORE = "pendingOrders";
const CACHE_STORE = "dataCache";

function getDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = req.result;
      if (!db.objectStoreNames.contains(ORDER_STORE)) {
        db.createObjectStore(ORDER_STORE, { keyPath: "tempId" });
      }
      if (!db.objectStoreNames.contains(CACHE_STORE)) {
        db.createObjectStore(CACHE_STORE, { keyPath: "key" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// === ORDER QUEUE ===

export async function queueOrder(orderData) {
  const db = await getDB();
  const tempId = "OFF-" + Date.now();
  const tx = db.transaction(ORDER_STORE, "readwrite");
  tx.objectStore(ORDER_STORE).put({
    ...orderData,
    tempId,
    createdAt: new Date().toISOString(),
    synced: false,
  });
  return tempId;
}

export async function getPendingOrders() {
  const db = await getDB();
  return new Promise((resolve) => {
    const tx = db.transaction(ORDER_STORE, "readonly");
    const req = tx.objectStore(ORDER_STORE).getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve([]);
  });
}

export async function getPendingCount() {
  const db = await getDB();
  return new Promise((resolve) => {
    const tx = db.transaction(ORDER_STORE, "readonly");
    const req = tx.objectStore(ORDER_STORE).count();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(0);
  });
}

export async function syncOrders(createFn) {
  const pending = await getPendingOrders();
  const results = [];
  const db = await getDB();

  for (const order of pending) {
    try {
      // Remove internal fields before sending to API
      const { tempId, createdAt, synced, ...orderData } = order;
      const result = await createFn(orderData);
      const tx = db.transaction(ORDER_STORE, "readwrite");
      tx.objectStore(ORDER_STORE).delete(order.tempId);
      results.push({ tempId: order.tempId, success: true });
    } catch (err) {
      results.push({
        tempId: order.tempId,
        success: false,
        error: err.message,
      });
    }
  }

  return results;
}

export async function clearQueue() {
  const db = await getDB();
  const tx = db.transaction(ORDER_STORE, "readwrite");
  tx.objectStore(ORDER_STORE).clear();
}

// === LOCAL DATA CACHE (products, settings, tables) ===

export async function cacheData(key, data) {
  try {
    const db = await getDB();
    const tx = db.transaction(CACHE_STORE, "readwrite");
    tx.objectStore(CACHE_STORE).put({
      key,
      data,
      updatedAt: new Date().toISOString(),
    });
  } catch {}
}

export async function getCachedData(key) {
  try {
    const db = await getDB();
    return new Promise((resolve) => {
      const tx = db.transaction(CACHE_STORE, "readonly");
      const req = tx.objectStore(CACHE_STORE).get(key);
      req.onsuccess = () => resolve(req.result?.data ?? null);
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}
