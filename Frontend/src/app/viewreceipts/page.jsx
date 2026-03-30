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
import { authAPI, receiptsAPI, productsAPI, settingsAPI } from "@/app/lib/api";
import { clearAuth, offlineAuthCheck } from "@/app/lib/authUtils";

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
  const [shopSettings, setShopSettings] = useState({});
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
    offlineAuthCheck(authAPI, router).then((user) => { if (user) setAuthChecked(true); });
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

    settingsAPI.get()
      .then((s) => setShopSettings(s || {}))
      .catch(() => {});
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
    const s = shopSettings;
    const shopName = s.shopName || "NELLAI KARUPATTI COFFEE";
    const shopTagline = s.shopTagline || "";
    const shopAddress = s.shopAddress || "";
    const shopCity = s.shopCity || "";
    const shopPhone = s.shopPhone || "";
    const gstNumber = s.gstNumber || "";
    const fssaiNumber = s.fssaiNumber || "";
    const footer = s.receiptFooter || "Thank You! Visit Again";

    const items = receipt.order || [];
    const itemRows = items.map((item) => {
      const qty = item.amount || item.quantity || item.qty || 1;
      const amt = ((item.price || 0) * qty).toFixed(2);
      const name = esc(item.name.length > 22 ? item.name.slice(0, 22) : item.name);
      return `<tr><td style="text-align:left">${name}</td><td style="text-align:center">${qty}</td><td style="text-align:right">${item.price}</td><td style="text-align:right">${amt}</td></tr>`;
    }).join("");

    const disc = receipt.discount > 0 ? `<tr><td colspan="3" style="text-align:left">Discount</td><td style="text-align:right">-₹${receipt.discount.toFixed(2)}</td></tr>` : "";
    const grandTotal = receipt.grandTotal || receipt.total || 0;
    const subtotal = receipt.total || receipt.grandTotal || 0;
    const billDate = receipt.date || new Date().toLocaleDateString("en-IN");
    const billTime = receipt.time || "";

    const html = `<!DOCTYPE html><html><head><title>Bill</title>
<style>
  @page { size: 80mm auto; margin: 0; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Courier New', monospace; font-size: 12px; width: 72mm; margin: 0 auto; padding: 4mm; color: #000; }
  .center { text-align: center; }
  .bold { font-weight: bold; }
  .sep { border-top: 1px dashed #000; margin: 4px 0; }
  .sep2 { border-top: 2px solid #000; margin: 4px 0; }
  table { width: 100%; border-collapse: collapse; }
  td { padding: 1px 0; vertical-align: top; }
  .right { text-align: right; }
  .small { font-size: 10px; }
  .big { font-size: 16px; font-weight: bold; }
</style></head><body>
  <div class="center bold" style="font-size:14px;letter-spacing:1px;">${esc(shopName)}</div>
  ${shopTagline ? `<div class="center small">${esc(shopTagline)}</div>` : ""}
  ${shopAddress ? `<div class="center small">${esc(shopAddress)}</div>` : ""}
  ${shopCity ? `<div class="center small">${esc(shopCity)}</div>` : ""}
  ${shopPhone ? `<div class="center small">Ph: ${esc(shopPhone)}</div>` : ""}
  ${gstNumber ? `<div class="center small">GSTIN: ${esc(gstNumber)}</div>` : ""}
  ${fssaiNumber ? `<div class="center small">FSSAI: ${esc(fssaiNumber)}</div>` : ""}
  <div class="sep2"></div>
  <div class="center bold">BILL</div>
  <div class="sep"></div>
  <table>
    <tr><td>Bill No: ${esc(receipt.billNo || receipt.orderNumber || "—")}</td><td class="right">Date: ${billDate}</td></tr>
    <tr><td>Payment: ${esc((receipt.paymentMethod || "cash").toUpperCase())}</td><td class="right">Time: ${billTime}</td></tr>
    <tr><td>Table: ${receipt.tableNo || "01"}</td><td class="right"></td></tr>
  </table>
  <div class="sep"></div>
  <table>
    <tr class="bold"><td style="text-align:left">Item</td><td style="text-align:center">Qty</td><td style="text-align:right">Rate</td><td style="text-align:right">Amt</td></tr>
  </table>
  <div class="sep"></div>
  <table>${itemRows}</table>
  <div class="sep"></div>
  <table>
    <tr><td colspan="3" style="text-align:left">Subtotal</td><td style="text-align:right">₹${subtotal.toFixed(2)}</td></tr>
    ${disc}
  </table>
  <div class="sep2"></div>
  <table><tr class="big"><td>TOTAL</td><td style="text-align:right">₹${grandTotal.toFixed(2)}</td></tr></table>
  <div class="sep2"></div>
  <div class="center" style="margin-top:6px;">
    <div class="bold">${esc(footer)}</div>
  </div>
</body></html>`;

    const iframe = document.createElement("iframe");
    iframe.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:none;";
    document.body.appendChild(iframe);
    iframe.contentDocument.open();
    iframe.contentDocument.write(html);
    iframe.contentDocument.close();
    iframe.contentWindow.focus();
    iframe.contentWindow.print();
    setTimeout(() => document.body.removeChild(iframe), 3000);
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
    <div className="w-full flex justify-center font-mono bg-gray-50 min-h-[100dvh] p-2 sm:p-4">
      {/* Toast Notification */}
      <AnimatePresence>
        {toast && <Toast message={toast} onClose={dismissToast} />}
      </AnimatePresence>

      <div className="w-full max-w-2xl mx-auto">
        {/* Sticky search/back header */}
        <div className="sticky top-0 z-10 bg-coffee-dark text-cream rounded-b-xl shadow-md px-3 sm:px-4 pb-3 pt-3 mb-3">
          <div className="mb-3 flex items-center gap-2">
            <button
              onClick={() => router.push("/pages/order")}
              className="flex items-center gap-1 text-sm text-cream/80 hover:text-cream transition min-h-[44px] min-w-[44px]"
            >
              <ArrowLeftIcon className="h-5 w-5" /> Back to Order
            </button>
          </div>

          <h1 className="text-xl sm:text-2xl font-bold mb-3 flex items-center gap-2 text-cream font-display">
            <HiReceiptRefund className="text-cream w-6 h-6" /> All Receipts
          </h1>

          {/* Search input */}
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search receipts..."
            className="w-full p-3 h-12 border border-white/20 rounded-lg text-sm text-coffee-dark bg-white focus:ring-2 focus:ring-accent"
          />
        </div>

        {(searchTerm
          ? receipts.filter(r =>
              (r.billNo || r.orderNumber || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
              (r.paymentMethod || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
              r.order?.some(i => i.name?.toLowerCase().includes(searchTerm.toLowerCase())) ||
              String(r.grandTotal).includes(searchTerm)
            )
          : receipts
        ).map((receipt, idx) => {
          const isEditing = editingId === receipt.id;
          const displayItems = isEditing ? editOrder : (receipt.order || []);
          const editTotal = isEditing ? displayItems.reduce((s, i) => s + i.price * i.amount, 0) : 0;

          return (
          <m.div
            key={receipt.id || idx}
            ref={isEditing ? editRef : null}
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, delay: idx < 20 ? idx * 0.03 : 0 }}
            className={`bg-white rounded-xl shadow-sm mb-3 border overflow-hidden ${isEditing ? "border-coffee ring-2 ring-coffee/20" : "border-gray-200"}`}
          >
            {/* Receipt header */}
            <div className="flex items-center justify-between px-3 sm:px-4 py-2.5 bg-coffee-dark text-cream">
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm font-display">#{receipt.billNo}</span>
                {receipt.status === "cancelled" && <span className="text-[10px] bg-red-500 text-white px-1.5 py-0.5 rounded font-bold uppercase">Cancelled</span>}
              </div>
              <div className="text-right text-[10px] sm:text-xs opacity-80">
                <div>{receipt.date}</div>
                <div>{receipt.time || ""}</div>
              </div>
            </div>

            <div className="p-3 sm:p-4">
              {/* Receipt info row */}
              <div className="flex items-center justify-between text-xs text-gray-500 mb-2">
                <span className="capitalize">{receipt.paymentMethod || "cash"}</span>
                <span>Table: {receipt.tableNo || "01"}</span>
              </div>

              {/* Items list */}
              <div className="space-y-1 mb-3">
                {displayItems.map((item, itemIdx) => (
                  <div key={itemIdx} className={`py-1.5 ${isEditing ? "bg-gray-50 rounded-lg px-2" : "border-b border-gray-100 last:border-0"}`}>
                    {isEditing ? (
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs sm:text-sm text-gray-800 truncate flex-1 min-w-0">{item.name}</span>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <button onClick={() => setEditOrder((prev) => prev.map((i, idx) => idx === itemIdx && i.amount > 1 ? { ...i, amount: i.amount - 1 } : i))}
                            className="w-8 h-8 flex items-center justify-center rounded-lg bg-gray-200 active:bg-gray-300 text-sm font-bold">-</button>
                          <span className="text-sm font-bold w-5 text-center">{item.amount}</span>
                          <button onClick={() => setEditOrder((prev) => prev.map((i, idx) => idx === itemIdx ? { ...i, amount: i.amount + 1 } : i))}
                            className="w-8 h-8 flex items-center justify-center rounded-lg bg-gray-200 active:bg-gray-300 text-sm font-bold">+</button>
                          <button onClick={() => setEditOrder((prev) => prev.filter((_, idx) => idx !== itemIdx))}
                            className="w-8 h-8 flex items-center justify-center rounded-lg bg-red-100 active:bg-red-200 text-red-500 ml-0.5"><HiTrash className="w-3.5 h-3.5" /></button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between">
                        <span className="text-xs sm:text-sm text-gray-800 truncate flex-1 min-w-0 pr-2">{item.name}</span>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className="text-xs text-gray-400">x{item.amount}</span>
                          <span className="text-xs sm:text-sm font-semibold text-gray-700 w-12 text-right">{(item.price * item.amount).toFixed(0)}</span>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Inline add item (when editing) */}
              {isEditing && (
                <div className="mb-3 border border-dashed border-coffee/30 rounded-lg p-2 bg-coffee/5">
                  <input
                    type="text"
                    value={menuSearchTerm}
                    onChange={(e) => setMenuSearchTerm(e.target.value)}
                    placeholder="Search to add item..."
                    className="w-full px-2.5 py-1.5 h-9 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-coffee outline-none mb-1"
                  />
                  {menuSearchTerm && (
                    <ul className="max-h-40 overflow-y-auto bg-white rounded-lg border border-gray-200">
                      {filteredMenu.slice(0, 10).map((item, i) => (
                        <li key={i} onClick={() => { addItemToEditOrder(item); setMenuSearchTerm(""); }}
                          className="cursor-pointer px-2.5 py-1.5 hover:bg-gray-50 flex items-center justify-between border-b border-gray-100 last:border-0">
                          <span className="text-sm truncate">{item.name}</span>
                          <span className="text-xs text-coffee font-semibold flex items-center gap-1">{item.price} <HiPlus className="w-3 h-3" /></span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              {/* Total */}
              <div className="flex items-center justify-between pt-2 border-t border-gray-200">
                <span className="text-sm font-bold text-gray-800">Total</span>
                <span className="text-lg font-bold text-coffee">{isEditing ? `${editTotal.toFixed(0)}` : `${(receipt.grandTotal || 0).toLocaleString("en-IN")}`}</span>
              </div>

              {/* Action buttons */}
              <div className="flex gap-1.5 sm:gap-2 mt-3">
                {isEditing ? (
                  <>
                    <button onClick={() => saveEditedReceipt(receipt.id)}
                      className="flex-1 h-11 bg-coffee text-cream rounded-lg active:bg-coffee-dark font-semibold text-xs sm:text-sm transition">Save</button>
                    <button onClick={() => setEditingId(null)}
                      className="flex-1 h-11 bg-gray-100 text-gray-700 rounded-lg active:bg-gray-200 font-semibold text-xs sm:text-sm transition">Cancel</button>
                  </>
                ) : (
                  <>
                    <button onClick={() => editReceipt(receipt)}
                      className="flex-1 h-11 flex items-center justify-center gap-1 bg-amber-50 text-amber-700 rounded-lg active:bg-amber-100 text-xs sm:text-sm font-semibold transition">
                      <HiPencil className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> Edit</button>
                    <button onClick={() => printReceipt(receipt)}
                      className="flex-1 h-11 flex items-center justify-center gap-1 bg-coffee text-cream rounded-lg active:bg-coffee-dark text-xs sm:text-sm font-semibold transition">
                      <HiPrinter className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> Print</button>
                    <button onClick={() => deleteReceipt(receipt.id, receipt.billNo)}
                      className="h-11 w-11 flex items-center justify-center bg-red-50 text-red-500 rounded-lg active:bg-red-100 transition flex-shrink-0">
                      <HiTrash className="w-4 h-4" /></button>
                  </>
                )}
              </div>
            </div>
          </m.div>
          );
        })}
        <p className="text-[10px] text-gray-400 text-center py-4">&copy; 2026 EndlessScript. All rights reserved.</p>
      </div>
    </div>
  );
}
