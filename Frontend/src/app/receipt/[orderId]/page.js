"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { HiPrinter, HiShare } from "react-icons/hi";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:5001";

export default function ReceiptPage() {
  const params = useParams();
  const orderId = params?.orderId;
  const [receipt, setReceipt] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentUrl, setCurrentUrl] = useState("");

  useEffect(() => {
    // Safe access to window.location (avoids SSR crash)
    if (typeof window !== "undefined") {
      setCurrentUrl(window.location.href);
    }
  }, []);

  useEffect(() => {
    if (!orderId) {
      setError("Receipt ID not found");
      setLoading(false);
      return;
    }

    const fetchReceipt = async () => {
      try {
        const response = await fetch(`${API_BASE}/api/receipts/${orderId}/public`);
        if (!response.ok) {
          if (response.status === 404) {
            setError("Receipt not found");
          } else if (response.status === 410) {
            setError("Receipt has expired");
          } else {
            setError("Failed to fetch receipt");
          }
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

  const handlePrint = () => {
    window.print();
  };

  const handleWhatsApp = () => {
    if (!receipt) return;
    const billNo = receipt.billNo || receipt.orderNumber || orderId;
    const total = receipt.grandTotal || receipt.total || 0;
    const date = receipt.date || new Date().toLocaleDateString("en-IN");
    const msg = encodeURIComponent(
      `Receipt from ${receipt.settings?.shopName || "Karupatti Coffee"}\nBill: ${billNo}\nTotal: ₹${total.toFixed(2)}\nDate: ${date}\n\nView: ${currentUrl}`
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
        <div className="text-center">
          <p className="text-coffee-dark font-medium">No receipt data available</p>
        </div>
      </div>
    );
  }

  const shopName = receipt.settings?.shopName || "KARUPATTI COFFEE";
  const shopAddress = receipt.settings?.shopAddress || "";
  const shopPhone = receipt.settings?.shopPhone || "";
  const gstNumber = receipt.settings?.gstNumber || "";
  const receiptFooter = receipt.settings?.receiptFooter || "Thank You! Visit Again";

  return (
    <>
      <style>{`
        @media print {
          @page { size: 80mm auto; margin: 0; }
          html, body { margin: 0; padding: 0; background: white !important; }
          body * { visibility: hidden; }
          .receipt-print, .receipt-print * { visibility: visible; }
          .receipt-print { position: absolute; left: 0; top: 0; width: 72mm; font-size: 12px; margin: 0 auto; box-shadow: none !important; border-radius: 0 !important; }
          .receipt-print * { background: white !important; color: black !important; box-shadow: none !important; }
          .no-print { display: none !important; }
          table { width: 100%; border-collapse: collapse; }
          td, th { padding: 2px 0; font-size: 12px; }
          .r-sep { border-top: 1px dashed #000 !important; }
        }
      `}</style>

      <div className="min-h-screen bg-tan py-4 px-3 sm:px-4">
        <div className="flex flex-col items-center max-w-lg mx-auto">
          {/* Header */}
          <div className="no-print mb-4 text-center">
            <h1 className="text-2xl sm:text-3xl font-bold text-coffee-dark font-display mb-1">
              Digital Receipt
            </h1>
            <p className="text-sm text-coffee-light">Order {receipt.orderNumber || `#${orderId}`}</p>
          </div>

          {/* Receipt */}
          <div className="receipt-print bg-white text-coffee-dark w-full shadow-lg rounded-xl overflow-hidden">
            <div className="bg-coffee-dark text-cream px-4 py-3 text-center">
              <p className="font-bold text-base sm:text-lg tracking-wider">{shopName}</p>
              <p className="text-[10px] text-cream/70 mt-0.5">Natural Karupatti Coffee Shop</p>
            </div>

            <div className="text-center text-[10px] sm:text-xs leading-tight px-4 pt-2 pb-1.5 text-coffee-light">
              {shopAddress && <p>{shopAddress}</p>}
              <p>
                {shopPhone && `Ph: ${shopPhone}`}
                {gstNumber && ` | GSTIN: ${gstNumber}`}
              </p>
            </div>

            <div className="r-sep border-t border-dashed border-coffee-light mx-3" />

            <div className="px-3 sm:px-4 py-1.5 text-[10px] sm:text-xs grid grid-cols-2 gap-x-4 gap-y-0.5">
              <div className="flex justify-between">
                <span className="text-coffee-light">Bill:</span>
                <span className="font-bold">{receipt.billNo || receipt.orderNumber || orderId}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-coffee-light">Date:</span>
                <span className="font-semibold">
                  {receipt.date
                    ? new Date(receipt.date).toLocaleDateString("en-IN")
                    : new Date().toLocaleDateString("en-IN")}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-coffee-light">Time:</span>
                <span className="font-semibold">
                  {receipt.time || new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-coffee-light">Payment:</span>
                <span className="capitalize font-semibold">{receipt.paymentMethod || "cash"}</span>
              </div>
            </div>

            <div className="r-sep border-t border-dashed border-coffee-light mx-3" />

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
                  {receipt.items && receipt.items.map((item, idx) => (
                    <tr key={idx} className="border-b border-dotted border-gray-200 last:border-b-0">
                      <td className="text-left py-1 pr-1">
                        <span className="block">{item.name}</span>
                        {item.notes && (
                          <span className="block text-[9px] text-coffee-light italic">{item.notes}</span>
                        )}
                      </td>
                      <td className="text-center py-1">{item.amount || item.quantity || 1}</td>
                      <td className="text-right py-1">{item.price}</td>
                      <td className="text-right py-1 font-semibold">
                        {((item.price || 0) * (item.amount || item.quantity || 1)).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="r-sep border-t border-dashed border-coffee-light mx-3" />

            <div className="px-3 sm:px-4 py-1.5 text-[10px] sm:text-xs space-y-0.5">
              <div className="flex justify-between">
                <span>
                  Subtotal ({receipt.items ? receipt.items.length : 0} items)
                </span>
                <span className="font-semibold">
                  ₹{(receipt.total || receipt.grandTotal || 0).toFixed(2)}
                </span>
              </div>
              {receipt.discount > 0 && (
                <div className="flex justify-between text-coffee">
                  <span>Discount</span>
                  <span className="font-semibold">- ₹{receipt.discount.toFixed(2)}</span>
                </div>
              )}
              <div className="r-sep border-t border-dashed border-coffee-light my-1" />
              <div className="flex justify-between text-sm sm:text-base font-bold pt-0.5">
                <span>TOTAL</span>
                <span>₹{(receipt.grandTotal || receipt.total || 0).toFixed(2)}</span>
              </div>
            </div>

            <div className="r-sep border-t border-dashed border-coffee-light mx-3" />
            <div className="text-center py-2 text-[10px] text-coffee-light">
              <p className="font-semibold text-coffee">{receiptFooter}</p>
            </div>
          </div>

          {/* Buttons */}
          <div className="no-print w-full mt-4 flex gap-2 sm:gap-3">
            <button
              onClick={handlePrint}
              className="flex-1 h-11 sm:h-12 bg-coffee text-cream rounded-xl flex items-center justify-center gap-2 font-semibold text-xs sm:text-sm hover:bg-coffee-dark transition-all shadow-md"
            >
              <HiPrinter className="h-4 w-4 sm:h-5 sm:w-5" /> Print
            </button>
            <button
              onClick={handleWhatsApp}
              className="flex-1 h-11 sm:h-12 bg-green-500 text-white rounded-xl flex items-center justify-center gap-2 font-semibold text-xs sm:text-sm hover:bg-green-600 transition-all shadow-md"
            >
              <HiShare className="h-4 w-4 sm:h-5 sm:w-5" /> WhatsApp
            </button>
          </div>

          {/* Link */}
          <div className="no-print mt-6 text-center max-w-xs">
            <p className="text-xs text-coffee-light mb-2">Save this link for your records:</p>
            <span className="inline-block text-xs font-mono bg-white border border-coffee-light rounded px-3 py-2 text-coffee-dark break-all">
              /receipt/{orderId}
            </span>
          </div>
          <p className="no-print text-[10px] text-gray-400 text-center mt-6">&copy; 2026 EndlessScript. All rights reserved.</p>
        </div>
      </div>
    </>
  );
}
