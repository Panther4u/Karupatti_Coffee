"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { HiPrinter, HiShare } from "react-icons/hi";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:5001";

function esc(str) { return String(str || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }

export default function ReceiptPage() {
  const params = useParams();
  const orderId = params?.orderId;
  const [receipt, setReceipt] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentUrl, setCurrentUrl] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined") setCurrentUrl(window.location.href);
  }, []);

  useEffect(() => {
    if (!orderId) { setError("Receipt ID not found"); setLoading(false); return; }

    const fetchReceipt = async () => {
      try {
        const response = await fetch(`${API_BASE}/api/receipts/${orderId}/public`);
        if (!response.ok) {
          if (response.status === 404) setError("Receipt not found");
          else if (response.status === 410) setError("Receipt has expired");
          else setError("Failed to fetch receipt");
          return;
        }
        const json = await response.json();
        setReceipt(json.data || json);
      } catch (err) {
        setError("Failed to load receipt. Please check your connection.");
      } finally {
        setLoading(false);
      }
    };
    fetchReceipt();
  }, [orderId]);

  // Print using same thermal bill format as order page
  const handlePrint = () => {
    if (!receipt) return;
    const items = receipt.items || receipt.order || [];
    const s = receipt.settings || {};
    const shopName = s.shopName || "NELLAI KARUPATTI COFFEE";
    const shopTagline = s.shopTagline || "";
    const shopAddress = s.shopAddress || "";
    const shopCity = s.shopCity || "";
    const shopPhone = s.shopPhone || "";
    const gstNumber = s.gstNumber || "";
    const fssaiNumber = s.fssaiNumber || "";
    const footer = s.receiptFooter || "Thank You! Visit Again";

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
    const billTime = receipt.time || new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true, timeZone: "Asia/Kolkata" });

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
    <div class="bold">${esc(footer)} ☕</div>
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

  const handleWhatsApp = () => {
    if (!receipt) return;
    const billNo = receipt.billNo || receipt.orderNumber || orderId;
    const total = receipt.grandTotal || receipt.total || 0;
    const date = receipt.date || new Date().toLocaleDateString("en-IN");
    const shopName = receipt.settings?.shopName || "Nellai Karupatti Coffee";
    const msg = encodeURIComponent(
      `Receipt from ${shopName}\nBill: ${billNo}\nTotal: ₹${total.toFixed(2)}\nDate: ${date}\n\nView: ${currentUrl}`
    );
    window.open(`https://wa.me/?text=${msg}`, "_blank");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-tan flex items-center justify-center px-3">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-coffee-light border-t-coffee rounded-full animate-spin mx-auto mb-4" />
          <p className="text-coffee-dark font-medium">Loading receipt...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-tan flex items-center justify-center px-3">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-lg p-6 border border-red-200">
          <div className="flex items-center justify-center w-10 h-10 bg-red-100 rounded-full mx-auto mb-4">
            <svg className="w-6 h-6 text-red-600" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
          </div>
          <h1 className="text-lg font-bold text-coffee-dark text-center mb-2">Receipt Error</h1>
          <p className="text-coffee-light text-center text-sm">{error}</p>
        </div>
      </div>
    );
  }

  if (!receipt) {
    return (
      <div className="min-h-screen bg-tan flex items-center justify-center px-3">
        <p className="text-coffee-dark font-medium">No receipt data available</p>
      </div>
    );
  }

  const shopName = receipt.settings?.shopName || "NELLAI KARUPATTI COFFEE";
  const shopTagline = receipt.settings?.shopTagline || "";
  const shopAddress = receipt.settings?.shopAddress || "";
  const shopCity = receipt.settings?.shopCity || "";
  const shopPhone = receipt.settings?.shopPhone || "";
  const gstNumber = receipt.settings?.gstNumber || "";
  const fssaiNumber = receipt.settings?.fssaiNumber || "";
  const receiptFooter = receipt.settings?.receiptFooter || "Thank You! Visit Again";
  const items = receipt.items || receipt.order || [];
  const grandTotal = receipt.grandTotal || receipt.total || 0;

  return (
    <div className="min-h-screen bg-tan py-4 px-3 sm:px-4">
      <div className="flex flex-col items-center max-w-lg mx-auto">
        {/* Header */}
        <div className="mb-4 text-center">
          <h1 className="text-2xl sm:text-3xl font-bold text-coffee-dark font-display mb-1">Bill</h1>
          <p className="text-sm text-coffee-light">#{receipt.billNo || receipt.orderNumber || orderId}</p>
        </div>

        {/* Bill Preview Card */}
        <div className="bg-white text-coffee-dark w-full shadow-lg rounded-xl overflow-hidden">
          <div className="bg-coffee-dark text-cream px-4 py-3 text-center">
            <p className="font-bold text-base sm:text-lg tracking-wider">{shopName}</p>
          </div>

          <div className="text-center text-[10px] sm:text-xs leading-tight px-4 pt-2 pb-1.5 text-coffee-light">
            {shopTagline && <p>{shopTagline}</p>}
            {shopAddress && <p>{shopAddress}</p>}
            {shopCity && <p>{shopCity}</p>}
            {shopPhone && <p>Ph: {shopPhone}</p>}
            {gstNumber && <p>GSTIN: {gstNumber}</p>}
            {fssaiNumber && <p>FSSAI: {fssaiNumber}</p>}
          </div>

          <div className="border-t border-dashed border-coffee-light mx-3" />

          <div className="px-3 sm:px-4 py-1.5 text-[10px] sm:text-xs grid grid-cols-2 gap-x-4 gap-y-0.5">
            <div className="flex justify-between">
              <span className="text-coffee-light">Bill No:</span>
              <span className="font-bold">{receipt.billNo || receipt.orderNumber || orderId}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-coffee-light">Date:</span>
              <span className="font-semibold">{receipt.date || new Date().toLocaleDateString("en-IN")}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-coffee-light">Time:</span>
              <span className="font-semibold">{receipt.time || ""}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-coffee-light">Payment:</span>
              <span className="capitalize font-semibold">{receipt.paymentMethod || "cash"}</span>
            </div>
          </div>

          <div className="border-t border-dashed border-coffee-light mx-3" />

          <div className="px-3 sm:px-4 py-1.5">
            <table className="w-full text-[10px] sm:text-xs">
              <thead>
                <tr className="border-b border-dashed border-coffee-light">
                  <th className="text-left py-1 font-semibold text-coffee">Item</th>
                  <th className="text-center py-1 font-semibold text-coffee w-8">Qty</th>
                  <th className="text-right py-1 font-semibold text-coffee w-12">Rate</th>
                  <th className="text-right py-1 font-semibold text-coffee w-14">Amt</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, idx) => {
                  const qty = item.amount || item.quantity || item.qty || 1;
                  return (
                    <tr key={idx} className="border-b border-dotted border-gray-200 last:border-b-0">
                      <td className="text-left py-1 pr-1">{item.name}</td>
                      <td className="text-center py-1">{qty}</td>
                      <td className="text-right py-1">{item.price}</td>
                      <td className="text-right py-1 font-semibold">{((item.price || 0) * qty).toFixed(2)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="border-t border-dashed border-coffee-light mx-3" />

          <div className="px-3 sm:px-4 py-1.5 text-[10px] sm:text-xs space-y-0.5">
            <div className="flex justify-between">
              <span>Subtotal ({items.length} items)</span>
              <span className="font-semibold">₹{(receipt.total || grandTotal).toFixed(2)}</span>
            </div>
            {receipt.discount > 0 && (
              <div className="flex justify-between text-coffee">
                <span>Discount</span>
                <span className="font-semibold">- ₹{receipt.discount.toFixed(2)}</span>
              </div>
            )}
            <div className="border-t border-dashed border-coffee-light my-1" />
            <div className="flex justify-between text-sm sm:text-base font-bold pt-0.5">
              <span>TOTAL</span>
              <span>₹{grandTotal.toFixed(2)}</span>
            </div>
          </div>

          <div className="border-t border-dashed border-coffee-light mx-3" />
          <div className="text-center py-2 text-[10px] text-coffee-light">
            <p className="font-semibold text-coffee">{receiptFooter} ☕</p>
          </div>
        </div>

        {/* Buttons */}
        <div className="w-full mt-4 flex gap-2 sm:gap-3">
          <button
            onClick={handlePrint}
            className="flex-1 h-11 sm:h-12 bg-coffee text-cream rounded-xl flex items-center justify-center gap-2 font-semibold text-xs sm:text-sm hover:bg-coffee-dark transition-all shadow-md"
          >
            <HiPrinter className="h-4 w-4 sm:h-5 sm:w-5" /> Print Bill
          </button>
          <button
            onClick={handleWhatsApp}
            className="flex-1 h-11 sm:h-12 bg-green-500 text-white rounded-xl flex items-center justify-center gap-2 font-semibold text-xs sm:text-sm hover:bg-green-600 transition-all shadow-md"
          >
            <HiShare className="h-4 w-4 sm:h-5 sm:w-5" /> WhatsApp
          </button>
        </div>

        <p className="text-[10px] text-gray-400 text-center mt-6">&copy; 2026 EndlessScript. All rights reserved.</p>
      </div>
    </div>
  );
}
