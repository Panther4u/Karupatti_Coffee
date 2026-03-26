"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import {
  HiReceiptRefund,
  HiPencil,
  HiTrash,
  HiPrinter,
  HiPlus,
} from "react-icons/hi";
import { motion as m, AnimatePresence } from "framer-motion";
import { ArrowLeftIcon } from "@heroicons/react/24/solid";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { getSocket } from "@/app/lib/socket";
import { authAPI, receiptsAPI, productsAPI } from "@/app/lib/api";

/** Toast notification component */
function Toast({ message, onClose }) {
  useEffect(() => {
    const timer = setTimeout(onClose, 4000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <m.div
      initial={{ opacity: 0, y: -40 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -40 }}
      className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-coffee text-cream px-5 py-3 rounded-xl shadow-lg font-mono text-sm max-w-[90vw] text-center"
    >
      {message}
    </m.div>
  );
}

export default function ViewReceipts() {
  const router = useRouter();
  const editRef = useRef(null);

  const [authChecked, setAuthChecked] = useState(false);
  const [receipts, setReceipts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [editOrder, setEditOrder] = useState([]);
  const [menu, setMenu] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [menuSearchTerm, setMenuSearchTerm] = useState("");
  const [toast, setToast] = useState(null);

  const showToast = useCallback((message) => {
    setToast(message);
  }, []);

  const dismissToast = useCallback(() => {
    setToast(null);
  }, []);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      router.replace("/");
      return;
    }

    // Verify token with backend
    authAPI.me()
      .then(() => setAuthChecked(true))
      .catch(() => {
        localStorage.removeItem("token");
        localStorage.removeItem("isAdmin");
        localStorage.removeItem("adminLoginTime");
        router.replace("/");
      });
  }, [router]);

  useEffect(() => {
    if (!authChecked) return;

    receiptsAPI.getAll()
      .then((data) => {
        const orders = data?.orders || data;
        const mapped = Array.isArray(orders) ? orders.map((o) => ({ id: o._id || o.id, ...o })) : [];
        setReceipts(mapped);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to load receipts:", err);
        setLoading(false);
      });

    productsAPI.getAll()
      .then((data) => {
        const items = Array.isArray(data)
          ? data
          : typeof data === "object"
          ? Object.values(data)
          : [];
        setMenu(items);
      })
      .catch((err) => console.error("Menu fetch failed:", err));
  }, [authChecked]);

  // Socket.io real-time listeners
  useEffect(() => {
    if (!authChecked) return;

    const socket = getSocket();
    if (!socket) return;

    const handleNewOrder = (orderData) => {
      setReceipts((prev) => [
        { id: orderData.id || orderData._id, ...orderData },
        ...prev,
      ]);
      showToast(`New order received: ${orderData.billNo || orderData.orderNumber || "Order"}`);
    };

    const handleOrderCancelled = (data) => {
      setReceipts((prev) =>
        prev.map((r) =>
          (r.id === data.id || r._id === data.id) ? { ...r, status: "cancelled" } : r
        )
      );
      showToast(`Order cancelled: ${data.billNo || data.orderNumber || "Order"}`);
    };

    const handleOrderDeleted = (data) => {
      setReceipts((prev) =>
        prev.filter((r) => r.id !== data.id && r._id !== data.id)
      );
      showToast(`Order deleted: ${data.billNo || data.orderNumber || "Order"}`);
    };

    socket.on("new-order", handleNewOrder);
    socket.on("order-cancelled", handleOrderCancelled);
    socket.on("order-deleted", handleOrderDeleted);

    return () => {
      socket.off("new-order", handleNewOrder);
      socket.off("order-cancelled", handleOrderCancelled);
      socket.off("order-deleted", handleOrderDeleted);
    };
  }, [authChecked, showToast]);

  useEffect(() => {
    if (editingId && editRef.current) {
      setTimeout(() => {
        editRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 100);
    }
  }, [editingId]);

  const deleteReceipt = async (id, billNo) => {
    if (!confirm(`Delete receipt ${billNo}?`)) return;
    try {
      await receiptsAPI.delete(id);
      setReceipts((prev) => prev.filter((r) => r.id !== id));
      alert("Deleted successfully!");
    } catch (err) {
      alert("Delete failed: " + (err.message || "Error deleting receipt."));
    }
  };

  const calculateTotal = (order) =>
    order.reduce((sum, item) => sum + item.price * item.amount, 0);

  const editReceipt = (receipt) => {
    setEditingId(receipt.id);
    setEditOrder([...receipt.order]);
  };

  const saveEditedReceipt = async (receiptId) => {
    const updatedTotal = calculateTotal(editOrder);
    const editReceipt = receipts.find((r) => r.id === receiptId);
    const discount = editReceipt?.discount || 0;
    const grandTotal = updatedTotal - discount;
    try {
      await receiptsAPI.update(receiptId, { order: editOrder, total: updatedTotal, grandTotal });
      alert("Receipt updated!");
      setReceipts((prev) =>
        prev.map((r) =>
          r.id === receiptId ? { ...r, order: editOrder, total: updatedTotal, grandTotal } : r
        )
      );
      setEditingId(null);
    } catch (err) {
      alert("Failed to save changes: " + (err.message || "Unknown error"));
    }
  };

  const esc = (s) => String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");

  const printReceipt = (receipt) => {
    const printable = window.open("", "", "width=400,height=600");
    printable.document.write(`
      <html><head><title>Receipt ${esc(receipt.billNo)}</title>
      <style>
        body { font-family: 'Courier New', monospace; width: 72mm; margin: 0 auto; padding: 8px; font-size: 12px; }
        .center { text-align: center; }
        .bold { font-weight: bold; }
        .sep { border-top: 1px dashed #000; margin: 6px 0; }
        table { width: 100%; border-collapse: collapse; }
        td { padding: 2px 0; }
        .right { text-align: right; }
      </style>
      </head>
      <body>
        <div class="center bold" style="font-size:14px;">KARUPATTI COFFEE</div>
        <div class="center" style="font-size:10px;">Natural Karupatti Coffee Shop</div>
        <div class="sep"></div>
        <div>Order: ${esc(receipt.billNo)}</div>
        <div>Date: ${receipt.date} ${receipt.time || ""}</div>
        <div>Payment: ${esc(receipt.paymentMethod)}</div>
        <div>Table: ${receipt.tableNo || "01"}</div>
        <div class="sep"></div>
        <table>
          <tr class="bold"><td>Item</td><td class="right">Qty</td><td class="right">Amt</td></tr>
          ${receipt.order
            .map(
              (item) =>
                `<tr><td>${esc(item.name)}</td><td class="right">${item.amount}</td><td class="right">${(item.price * item.amount).toFixed(2)}</td></tr>`
            )
            .join("")}
        </table>
        <div class="sep"></div>
        <div class="bold right" style="font-size:14px;">Total: Rs. ${receipt.grandTotal.toFixed(2)}</div>
        <div class="sep"></div>
        <div class="center bold">Thank You! Visit Again</div>
        <div class="small" style="margin-top:4px;color:#999;text-align:center;">Powered by EndlessScript</div>
      </body></html>`);
    printable.document.close();
    printable.print();
  };

  const addItemToEditOrder = (item) => {
    const exists = editOrder.find((i) => i.name === item.name);
    if (exists) {
      setEditOrder((prev) =>
        prev.map((i) =>
          i.name === item.name ? { ...i, amount: i.amount + 1 } : i
        )
      );
    } else {
      setEditOrder((prev) => [...prev, { ...item, amount: 1 }]);
    }
  };

  const filteredMenu = menu.filter(
    (item) =>
      typeof item.name === "string" &&
      item.name.toLowerCase().includes(menuSearchTerm.toLowerCase())
  );

  if (!authChecked) return <p className="p-4 text-center text-coffee-dark min-h-[100dvh] flex items-center justify-center">Checking access...</p>;
  if (loading) return <p className="p-4 text-center text-coffee-dark min-h-[100dvh] flex items-center justify-center">Loading receipts...</p>;

  return (
    <div className="w-full flex justify-center font-mono bg-white min-h-[100dvh] p-3 sm:p-4">
      {/* Toast Notification */}
      <AnimatePresence>
        {toast && <Toast message={toast} onClose={dismissToast} />}
      </AnimatePresence>

      <div className="w-full">
        {/* Sticky search/back header */}
        <div className="sticky top-0 z-10 bg-white pb-3 pt-1">
          <div className="mb-3 flex items-center gap-2">
            <button
              onClick={() => router.push("/pages/order")}
              className="flex items-center gap-1 text-sm text-coffee-light hover:text-coffee-dark transition min-h-[44px] min-w-[44px]"
            >
              <ArrowLeftIcon className="h-5 w-5" /> Back to Order
            </button>
          </div>

          <h1 className="text-xl sm:text-2xl font-bold mb-3 flex items-center gap-2 text-coffee-dark font-display">
            <HiReceiptRefund className="text-coffee w-6 h-6" /> All Receipts
          </h1>

          {/* Search input */}
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search receipts..."
            className="w-full p-3 h-12 border border-tan rounded-lg text-sm text-coffee-dark bg-white focus:ring-2 focus:ring-accent"
          />
        </div>

        {editingId && (
          <div
            ref={editRef}
            className="mb-4 border border-tan rounded-xl bg-tan shadow-sm p-3 grid grid-cols-1 md:grid-cols-2 gap-4"
          >
            <div>
              <h2 className="text-base sm:text-lg font-semibold mb-2 text-coffee-dark">Receipt Items</h2>
              <ul className="space-y-2">
                {editOrder.map((item, index) => (
                  <li
                    key={index}
                    className="flex justify-between items-center bg-white border border-tan rounded-lg p-2"
                  >
                    <div>
                      <p className="font-semibold text-sm text-coffee-dark">{item.name}</p>
                      <p className="text-xs text-coffee-light">Rs. {item.price}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() =>
                          setEditOrder((prev) =>
                            prev.map((i, idx) =>
                              idx === index && i.amount > 1 ? { ...i, amount: i.amount - 1 } : i
                            )
                          )
                        }
                        className="min-w-[44px] min-h-[44px] flex items-center justify-center text-sm bg-tan hover:bg-gray-200 rounded-lg"
                      >
                        -
                      </button>
                      <span className="text-sm min-w-[20px] text-center text-coffee-dark">{item.amount}</span>
                      <button
                        onClick={() =>
                          setEditOrder((prev) =>
                            prev.map((i, idx) =>
                              idx === index ? { ...i, amount: i.amount + 1 } : i
                            )
                          )
                        }
                        className="min-w-[44px] min-h-[44px] flex items-center justify-center text-sm bg-tan hover:bg-gray-200 rounded-lg"
                      >
                        +
                      </button>
                      <button
                        onClick={() =>
                          setEditOrder((prev) =>
                            prev.filter((_, idx) => idx !== index)
                          )
                        }
                        className="min-w-[44px] min-h-[44px] flex items-center justify-center text-red-500 hover:underline text-xs"
                      >
                        Remove
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h2 className="text-base sm:text-lg font-semibold mb-2 text-coffee-dark">Search Menu</h2>
              <input
                type="text"
                value={menuSearchTerm}
                onChange={(e) => setMenuSearchTerm(e.target.value)}
                placeholder="Search item by name..."
                className="w-full p-3 h-12 border border-tan rounded-lg mb-2 text-coffee-dark bg-white focus:ring-2 focus:ring-accent"
              />
              <ul className="max-h-[40vh] sm:max-h-80 overflow-y-auto bg-white text-coffee-dark rounded-lg border border-tan">
                {filteredMenu.map((item, i) => (
                  <li
                    key={i}
                    onClick={() => addItemToEditOrder(item)}
                    className="cursor-pointer px-3 py-2 min-h-[44px] hover:bg-tan flex items-center gap-3 border-b border-tan last:border-b-0"
                  >
                    <div className="w-10 h-10 relative rounded-lg overflow-hidden flex-shrink-0">
                      <Image
                        src={(() => { if (!item.imageUrl) return "/placeholder.png"; let u = item.imageUrl.replace(/[\r\n]+/g,"").trim().replace(/%20/g," "); if (!u.includes("imagekit.io")) return u; return `${u}${u.includes("?")?"&":"?"}tr=w-80,h-80,c-at_max`; })()}
                        loading="lazy"
                        quality={75}
                        alt={item.name}
                        fill
                        className="object-cover rounded-lg"
                      />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium truncate">{item.name}</p>
                      <p className="text-xs text-coffee-light">Rs. {item.price}</p>
                    </div>
                    <HiPlus className="text-coffee" />
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {(searchTerm
          ? receipts.filter(r =>
              (r.billNo || r.orderNumber || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
              (r.paymentMethod || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
              r.order?.some(i => i.name?.toLowerCase().includes(searchTerm.toLowerCase())) ||
              String(r.grandTotal).includes(searchTerm)
            )
          : receipts
        ).map((receipt, idx) => (
          <m.div
            key={receipt.id || idx}
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: idx < 20 ? idx * 0.05 : 0 }}
            className="bg-white p-3 sm:p-4 rounded-xl shadow-sm mb-3 border border-tan"
          >
            <div className="bg-coffee text-cream font-bold text-center rounded-lg px-2 py-2 mb-3 font-display">
              Receipt #{receipt.billNo}
            </div>
            <div className="text-sm text-coffee-dark space-y-1">
              <p><strong className="text-coffee-light">Date:</strong> {receipt.date}</p>
              <p><strong className="text-coffee-light">Time:</strong> {receipt.time || "N/A"}</p>
              <p><strong className="text-coffee-light">Payment:</strong> {receipt.paymentMethod}</p>
              <p><strong className="text-coffee-light">Table:</strong> {receipt.tableNo || "01"}</p>
              <p><strong className="text-coffee-light">Total:</strong> <span className="font-bold text-coffee">Rs. {receipt.grandTotal?.toLocaleString("en-IN") || "0"}</span></p>
              {receipt.status === "cancelled" && (
                <p className="text-red-500 font-bold text-xs uppercase">Cancelled</p>
              )}
            </div>
            <div className="mt-3">
              <p className="font-semibold text-coffee text-sm">Items:</p>
              <ul className="text-sm text-coffee-dark">
                {(editingId === receipt.id ? editOrder : receipt.order)?.map(
                  (item, itemIdx) => (
                    <li key={itemIdx} className="flex justify-between items-center py-0.5">
                      <span>{item.name} x {item.amount}</span>
                      <span className="text-coffee-light text-xs">
                        Rs. {(item.price * item.amount).toFixed(2)}
                      </span>
                    </li>
                  )
                )}
              </ul>
            </div>
            <div className="flex flex-wrap justify-end gap-2 mt-4">
              {editingId === receipt.id ? (
                <>
                  <button
                    onClick={() => saveEditedReceipt(receipt.id)}
                    className="min-h-[44px] px-4 py-2 bg-coffee text-cream rounded-lg hover:bg-coffee-dark btn-press font-semibold text-sm"
                  >Save</button>
                  <button
                    onClick={() => setEditingId(null)}
                    className="min-h-[44px] px-4 py-2 bg-tan text-coffee-dark rounded-lg hover:bg-gray-300 btn-press font-semibold text-sm"
                  >Cancel</button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => editReceipt(receipt)}
                    className="min-h-[44px] flex items-center px-3 py-2 bg-accent text-coffee-dark rounded-lg hover:bg-caramel btn-press text-sm font-semibold"
                  ><HiPencil className="mr-1" /> Edit</button>
                  <button
                    onClick={() => deleteReceipt(receipt.id, receipt.billNo)}
                    className="min-h-[44px] flex items-center px-3 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 btn-press text-sm font-semibold"
                  ><HiTrash className="mr-1" /> Delete</button>
                  <button
                    onClick={() => printReceipt(receipt)}
                    className="min-h-[44px] flex items-center px-3 py-2 bg-coffee text-cream rounded-lg hover:bg-coffee-dark btn-press text-sm font-semibold"
                  ><HiPrinter className="mr-1" /> Print</button>
                </>
              )}
            </div>
          </m.div>
        ))}
        <p className="text-[10px] text-gray-400 text-center py-4">&copy; 2026 EndlessScript. All rights reserved.</p>
      </div>
    </div>
  );
}
