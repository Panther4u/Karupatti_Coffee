const DB_NAME = "karupatti-offline";
const STORE = "pendingOrders";

function getDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () =>
      req.result.createObjectStore(STORE, { keyPath: "tempId" });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function queueOrder(orderData) {
  const db = await getDB();
  const tempId = "OFF-" + Date.now();
  const tx = db.transaction(STORE, "readwrite");
  tx.objectStore(STORE).put({
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
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve([]);
  });
}

export async function getPendingCount() {
  const db = await getDB();
  return new Promise((resolve) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).count();
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
      const result = await createFn(order);
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).delete(order.tempId);
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
  const tx = db.transaction(STORE, "readwrite");
  tx.objectStore(STORE).clear();
}
