"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Bars4Icon,
} from "@heroicons/react/24/solid";
import {
  HiShoppingCart,
  HiX,
  HiPrinter,
  HiHome,
  HiCheckCircle,
  HiExclamationCircle,
  HiShare,
  HiSearch,
  HiClock,
  HiUser,
  HiTag,
  HiCollection,
  HiCash,
  HiCreditCard,
  HiDeviceMobile,
  HiMinus,
  HiPlus,
  HiTrash,
  HiArrowUp,
  HiArrowDown,
} from "react-icons/hi";
import Sidebar from "../../components/Sidebar";
import {
  authAPI,
  productsAPI,
  ordersAPI,
  tablesAPI,
  shiftsAPI,
  customersAPI,
  settingsAPI,
  expensesAPI,
  reportsAPI,
} from "@/app/lib/api";
import { queueOrder, getPendingCount, syncOrders, cacheData, getCachedData } from "@/app/lib/offlineQueue";
import { getISTToday } from "@/app/lib/dateUtils";
import { calculateSalesSummary, calculateExpenseSummary, aggregatePaymentMethods } from "@/app/lib/calculations";
import { clearAuth } from "@/app/lib/authUtils";
const cleanUrl = (u) => (u ? u.replace(/[\r\n]+/g, "").trim().replace(/%20/g, " ") : "");
// Product.type (1-13) → category name
const categoryMap = {1:"Tea",2:"Coffee",3:"Dairy Products",4:"Snacks",5:"Evening Special",6:"Fresh Juice",7:"Cool Drinks",8:"Ice Cream",9:"Karupatti Ice Cream",10:"Karupatti Snacks",11:"Other Snacks",12:"Biscuits & Cakes",13:"Parcel"};
const menusType = Object.values(categoryMap); // index 0=Tea(type1), 1=Coffee(type2), etc.

export default function OrderPage() {
  const router = useRouter();
  const searchRef = useRef(null);

  // Auth & Loading
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Products
  const [products, setProducts] = useState([]);

  // UI State
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [currentCategory, setCurrentCategory] = useState(null);

  // Bill State — restore from localStorage on mount
  const [billItems, setBillItems] = useState(() => {
    if (typeof window === "undefined") return [];
    try { const saved = localStorage.getItem("pos_bill"); return saved ? JSON.parse(saved) : []; } catch { return []; }
  });
  const [selectedBillIndex, setSelectedBillIndex] = useState(-1);
  const [billFocused, setBillFocused] = useState(false);
  const [tableNo, setTableNo] = useState(() => {
    if (typeof window === "undefined") return "";
    return localStorage.getItem("pos_table") || "";
  });
  const [orderType, setOrderType] = useState(() => {
    if (typeof window === "undefined") return "dine-in";
    return localStorage.getItem("pos_orderType") || "dine-in";
  });
  const [customer, setCustomer] = useState(null);
  const [discountAmount, setDiscountAmount] = useState(() => {
    if (typeof window === "undefined") return 0;
    return Number(localStorage.getItem("pos_discount") || 0);
  });
  const [discountCode, setDiscountCode] = useState("");

  // Persist bill to localStorage on every change
  useEffect(() => {
    try {
      localStorage.setItem("pos_bill", JSON.stringify(billItems));
      localStorage.setItem("pos_table", tableNo);
      localStorage.setItem("pos_orderType", orderType);
      localStorage.setItem("pos_discount", String(discountAmount));
    } catch {}
  }, [billItems, tableNo, orderType, discountAmount]);

  // Popups
  const [activePopup, setActivePopup] = useState(null);
  // Qty popup state — product selected before adding to bill
  const [pendingProduct, setPendingProduct] = useState(null);
  const [pendingQty, setPendingQty] = useState(1);
  const [pendingNotes, setPendingNotes] = useState("");

  // Payment
  const [radioChecked, setRadioChecked] = useState("cash");
  const [cashReceived, setCashReceived] = useState("");

  // Order Save State
  const [saving, setSaving] = useState(false);
  const [orderSaved, setOrderSaved] = useState(false);
  const [orderError, setOrderError] = useState(null);
  const [receiptData, setReceiptData] = useState(null);
  const [lastOrderId, setLastOrderId] = useState(null);

  // Shop settings (tax config, etc.)
  const [shopSettings, setShopSettings] = useState({
    taxEnabled: false, cgstRate: 2.5, sgstRate: 2.5, inclusiveTax: true,
    shopName: "Karupatti Coffee", gstNumber: "", roundOff: true,
  });

  // Tables & Shifts
  const [tables, setTables] = useState([]);
  const [shift, setShift] = useState(null);
  const [cashier, setCashier] = useState("Cashier");
  const [userRole, setUserRole] = useState("cashier");

  // Online/Offline state
  const [isOnline, setIsOnline] = useState(true);
  const [offlineCount, setOfflineCount] = useState(0);
  const [syncing, setSyncing] = useState(false);

  // Auth check
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const user = await authAPI.me();
        setIsAuthenticated(true);
        setCashier(user.username || "Cashier");
        setUserRole(user.role || "cashier");
      } catch (err) {
        router.push("/");
      } finally {
        setIsLoading(false);
      }
    };
    checkAuth();
  }, [router]);

  // Load products (online → fetch + cache, offline → use cached data)
  useEffect(() => {
    if (!isAuthenticated) return;
    const loadData = async () => {
      try {
        const prods = await productsAPI.getAll({ available: true });
        const mapped = prods.map((p) => ({ ...p, imageUrl: cleanUrl(p.imageUrl) }));
        setProducts(mapped);
        // Cache for offline use
        cacheData("products", mapped);

        const tbls = await tablesAPI.getAll();
        setTables(tbls || []);
        cacheData("tables", tbls || []);

        const sh = await shiftsAPI.current();
        setShift(sh);

        try {
          const s = await settingsAPI.get();
          if (s) { setShopSettings(s); cacheData("settings", s); }
        } catch {}
      } catch (err) {
        console.error("Online load failed, trying offline cache:", err.message);
        // Fallback to cached data when offline
        const cachedProds = await getCachedData("products");
        if (cachedProds) setProducts(cachedProds);
        const cachedTables = await getCachedData("tables");
        if (cachedTables) setTables(cachedTables);
        const cachedSettings = await getCachedData("settings");
        if (cachedSettings) setShopSettings(cachedSettings);
      }
    };
    loadData();
  }, [isAuthenticated]);

  // Auto-sync helper — uses ordersAPI.create()
  const doSync = useCallback(async () => {
    const count = await getPendingCount();
    if (count === 0) return;
    setSyncing(true);
    try {
      const results = await syncOrders((orderData) => ordersAPI.create(orderData));
      const synced = results.filter((r) => r.success).length;
      const remaining = await getPendingCount();
      setOfflineCount(remaining);
      if (synced > 0) playBeep();
    } catch (err) {
      console.error("Sync failed:", err);
    } finally {
      setSyncing(false);
    }
  }, []);

  // Online/Offline detection + auto-sync + periodic retry
  useEffect(() => {
    setIsOnline(navigator.onLine);
    getPendingCount().then(setOfflineCount).catch(() => {});

    const goOnline = () => { setIsOnline(true); doSync(); };
    const goOffline = () => { setIsOnline(false); };

    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);

    // Periodic retry every 30s when online with pending orders
    const retryInterval = setInterval(() => {
      if (navigator.onLine) {
        getPendingCount().then((c) => { if (c > 0) doSync(); });
      }
    }, 30000);

    // Sync on mount if online
    if (navigator.onLine) doSync();

    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
      clearInterval(retryInterval);
    };
  }, [doSync]);

  // Filter products on search
  useEffect(() => {
    if (!searchText) {
      setFilteredProducts([]);
      setSelectedIndex(0);
      return;
    }
    const search = searchText.toLowerCase();
    const results = products.filter((p) =>
      p.name.toLowerCase().includes(search)
    );
    setFilteredProducts(results);
    setSelectedIndex(0);
  }, [searchText, products]);

  // Refocus search
  const refocusSearch = useCallback(() => {
    if (searchRef.current) {
      searchRef.current.focus();
    }
  }, []);

  // Compute bill totals
  const subtotal = billItems.reduce((sum, item) => sum + item.itemTotal, 0);
  const taxableAmount = Math.max(0, subtotal - discountAmount);
  const taxOn = shopSettings.taxEnabled && !shopSettings.inclusiveTax;
  const cgst = taxOn ? Math.round(taxableAmount * (shopSettings.cgstRate || 0) / 100 * 100) / 100 : 0;
  const sgst = taxOn ? Math.round(taxableAmount * (shopSettings.sgstRate || 0) / 100 * 100) / 100 : 0;
  const grandTotalRaw = subtotal - discountAmount + cgst + sgst;
  const grandTotal = shopSettings.roundOff ? Math.round(grandTotalRaw) : grandTotalRaw;

  const esc = (s) => String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");

  // Print thermal receipt in hidden iframe
  const printReceipt = (data) => {
    if (!data) return;
    const items = data.items || [];
    const itemRows = items.map((item) => {
      const qty = item.amount || item.qty || 1;
      const amt = (item.price * qty).toFixed(2);
      const name = esc(item.name.length > 22 ? item.name.slice(0, 22) : item.name);
      return `<tr><td style="text-align:left">${name}</td><td style="text-align:center">${qty}</td><td style="text-align:right">${item.price}</td><td style="text-align:right">${amt}</td></tr>`;
    }).join("");

    const disc = data.discount > 0 ? `<tr><td colspan="3" style="text-align:left">Discount</td><td style="text-align:right">-₹${data.discount.toFixed(2)}</td></tr>` : "";

    const html = `<!DOCTYPE html><html><head><title>Receipt</title>
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
  <div class="center bold" style="font-size:14px;letter-spacing:1px;">KARUPATTI COFFEE</div>
  <div class="center small">Natural Karupatti Coffee Shop</div>
  <div class="center small">North Pradakshanam Road, Karur</div>
  <div class="center small">Tamil Nadu | Ph: 7010452495</div>
  <div class="center small">GSTIN: 33GGTPS6619J1ZJ</div>
  <div class="sep2"></div>
  <div class="center bold">TAX INVOICE</div>
  <div class="sep"></div>
  <table>
    <tr><td>Bill: ${esc(data.billNo || "—")}</td><td class="right">${data.date || ""}</td></tr>
    <tr><td>Invoice: ${esc(data.invoiceNumber || "—")}</td><td class="right">${data.time || ""}</td></tr>
    <tr><td>Payment: ${esc((data.payment || "").toUpperCase())}</td><td class="right">Table: ${tableNo || "01"}</td></tr>
  </table>
  <div class="sep"></div>
  <table>
    <tr class="bold"><td style="text-align:left">Item</td><td style="text-align:center">Qty</td><td style="text-align:right">Rate</td><td style="text-align:right">Amt</td></tr>
  </table>
  <div class="sep"></div>
  <table>${itemRows}</table>
  <div class="sep"></div>
  <table>
    <tr><td colspan="3" style="text-align:left">Subtotal</td><td style="text-align:right">₹${data.subtotal?.toFixed(2) || "0.00"}</td></tr>
    ${disc}
    <tr class="small"><td colspan="3">CGST</td><td style="text-align:right">₹${cgst.toFixed(2)}</td></tr>
    <tr class="small"><td colspan="3">SGST</td><td style="text-align:right">₹${sgst.toFixed(2)}</td></tr>
  </table>
  <div class="sep2"></div>
  <table><tr class="big"><td>TOTAL</td><td style="text-align:right">₹${data.grandTotal?.toFixed(2) || "0.00"}</td></tr></table>
  <div class="sep2"></div>
  <div class="center" style="margin-top:6px;">
    <div class="bold">Thank You! Visit Again ☕</div>
    <div class="small" style="margin-top:2px;">Karupatti Coffee POS</div>
    <div class="small" style="margin-top:4px;color:#999;">Powered by EndlessScript</div>
  </div>
</body></html>`;

    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.right = "0";
    iframe.style.bottom = "0";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "none";
    document.body.appendChild(iframe);
    const doc = iframe.contentDocument || iframe.contentWindow.document;
    doc.open();
    doc.write(html);
    doc.close();
    setTimeout(() => {
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
      setTimeout(() => document.body.removeChild(iframe), 2000);
    }, 300);
  };

  // Sound beep
  const playBeep = () => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 800;
      osc.type = "sine";
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.1);
    } catch (e) {}
  };

  // Open qty popup for a product (click or Enter)
  const selectProduct = (product) => {
    setPendingProduct(product);
    setPendingQty(1);
    setPendingNotes("");
    setActivePopup("addItem");
    setSearchText("");
  };

  // Confirm add to bill (from qty popup)
  const confirmAddToBill = () => {
    if (!pendingProduct || pendingQty < 1) return;
    const product = pendingProduct;
    const qty = pendingQty;
    const notes = pendingNotes;
    const unitPrice = product.price;

    setBillItems((prev) => {
      const existing = prev.findIndex(
        (item) => item.productId === product._id && item.notes === notes
      );
      if (existing >= 0) {
        const updated = [...prev];
        updated[existing].qty += qty;
        updated[existing].itemTotal = updated[existing].unitPrice * updated[existing].qty;
        return updated;
      }
      return [...prev, {
        id: Date.now(), productId: product._id, name: product.name,
        variant: null, addons: "", qty, unitPrice, addonsTotal: 0,
        itemTotal: unitPrice * qty, notes,
      }];
    });

    setPendingProduct(null);
    setActivePopup(null);
    playBeep();
    refocusSearch();
  };

  // Cancel qty popup
  const cancelAddItem = () => {
    setPendingProduct(null);
    setActivePopup(null);
    refocusSearch();
  };

  // Update bill item
  const updateBillItem = (index, changes) => {
    setBillItems((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], ...changes };
      updated[index].itemTotal =
        updated[index].unitPrice * updated[index].qty +
        updated[index].addonsTotal;
      return updated;
    });
    refocusSearch();
  };

  // Remove bill item
  const removeBillItem = (index) => {
    setBillItems((prev) => prev.filter((_, i) => i !== index));
    refocusSearch();
  };

  // Clear bill
  const clearBill = () => {
    setBillItems([]);
    setTableNo("");
    setOrderType("dine-in");
    setCustomer(null);
    setDiscountAmount(0);
    setDiscountCode("");
    setRadioChecked("cash");
    setCashReceived("");
    setActivePopup(null);
    // Clear persisted bill data
    try { localStorage.removeItem("pos_bill"); localStorage.removeItem("pos_table"); localStorage.removeItem("pos_orderType"); localStorage.removeItem("pos_discount"); } catch {}
    refocusSearch();
  };

  // Search input handler — just update text, no auto-add
  const handleSearchChange = (e) => {
    setSearchText(e.target.value);
  };

  // Search key down — full keyboard navigation
  const handleSearchKeyDown = (e) => {
    // === SEARCH HAS TEXT → navigate search results ===
    if (searchText && filteredProducts.length > 0) {
      if (e.key === "ArrowDown") { e.preventDefault(); setSelectedIndex((p) => Math.min(filteredProducts.length - 1, p + 1)); return; }
      if (e.key === "ArrowUp") { e.preventDefault(); setSelectedIndex((p) => Math.max(0, p - 1)); return; }
      if (e.key === "Enter") {
        e.preventDefault();
        const qtyMatch = searchText.match(/^(\d+)\s*(.*)/);
        const product = filteredProducts[selectedIndex];
        setPendingProduct(product);
        setPendingQty(qtyMatch && parseInt(qtyMatch[1]) > 0 ? parseInt(qtyMatch[1]) : 1);
        setPendingNotes(""); setActivePopup("addItem"); setSearchText("");
        return;
      }
    }

    // === SEARCH EMPTY + NO CATEGORY → navigate category grid with arrows ===
    if (!searchText && currentCategory === null) {
      if (e.key === "ArrowDown" || e.key === "ArrowRight") {
        e.preventDefault();
        setSelectedIndex((p) => Math.min(menusType.length - 1, p + 1));
        return;
      }
      if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
        e.preventDefault();
        setSelectedIndex((p) => Math.max(0, p - 1));
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        setCurrentCategory(selectedIndex); setSelectedIndex(0);
        return;
      }
      // Number keys 1-9 → quick select category
      if (e.key >= "1" && e.key <= "9" && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        const idx = parseInt(e.key) - 1;
        if (idx < menusType.length) { setCurrentCategory(idx); setSelectedIndex(0); }
        return;
      }
    }

    // === SEARCH EMPTY + INSIDE CATEGORY → navigate category products ===
    if (!searchText && currentCategory !== null) {
      if (e.key === "ArrowDown" || e.key === "ArrowRight") {
        e.preventDefault();
        const catProds = products.filter((p) => p.type === currentCategory + 1);
        setSelectedIndex((p) => Math.min(catProds.length - 1, p + 1));
        return;
      }
      if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
        e.preventDefault();
        setSelectedIndex((p) => Math.max(0, p - 1));
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        const catProds = products.filter((p) => p.type === currentCategory + 1);
        if (catProds[selectedIndex]) { selectProduct(catProds[selectedIndex]); }
        return;
      }
      if (e.key === "Backspace" && !searchText) {
        e.preventDefault();
        setCurrentCategory(null); setSelectedIndex(0);
        return;
      }
    }

    // === ESCAPE always ===
    if (e.key === "Escape") {
      e.preventDefault();
      if (searchText) { setSearchText(""); }
      else if (currentCategory !== null) { setCurrentCategory(null); setSelectedIndex(0); }
      return;
    }
  };

  // === GLOBAL KEYBOARD SHORTCUTS (work everywhere) ===
  useEffect(() => {
    const handler = (e) => {
      // Inside popup → let popup handle its own keys
      if (activePopup) {
        // Order complete popup: P=Print, W=WhatsApp, Enter=New Order
        if (activePopup === "complete") {
          if (e.key === "p" || e.key === "P") { e.preventDefault(); printReceipt(receiptData); return; }
          if (e.key === "w" || e.key === "W") {
            e.preventDefault();
            if (receiptData) {
              const msg = encodeURIComponent(`Receipt from Karupatti Coffee\nBill: ${receiptData.billNo}\nTotal: ₹${receiptData.grandTotal?.toFixed(0)}\nView: ${window.location.origin}/receipt/${receiptData.id}`);
              window.open(`https://wa.me/?text=${msg}`, "_blank");
            }
            return;
          }
          if (e.key === "Enter" || e.key === " " || e.key === "Escape") {
            e.preventDefault(); clearBill(); setActivePopup(null); setBillFocused(false); refocusSearch();
            return;
          }
          return;
        }
        // Payment popup: let it handle 1/2/3, Enter, Escape internally via onKeyDown
        // Other popups: Escape closes
        if (e.key === "Escape") { e.preventDefault(); setActivePopup(null); setBillFocused(false); refocusSearch(); }
        return;
      }

      // F-keys work even when typing in search or bill
      if (e.key === "F1") { e.preventDefault(); clearBill(); setBillFocused(false); refocusSearch(); return; }
      if (e.key === "F2") { e.preventDefault(); if (billItems.length) setActivePopup("held"); return; }
      if (e.key === "F4") { e.preventDefault(); setActivePopup("customer"); return; }
      if (e.key === "F5") { e.preventDefault(); if (billItems.length) setActivePopup("payment"); return; }
      if (e.key === "F6") { e.preventDefault(); setActivePopup("discount"); return; }
      if (e.key === "F9") { e.preventDefault(); setActivePopup("table"); return; }
      if (e.key === "F12") { e.preventDefault(); setActivePopup("shift"); return; }

      // Tab key → switch between search (left) and bill (right)
      if (e.key === "Tab" && !e.target.closest("[data-popup]")) {
        e.preventDefault();
        if (billFocused) {
          // Switch to search side
          setBillFocused(false);
          setSelectedBillIndex(-1);
          refocusSearch();
        } else if (billItems.length > 0) {
          // Switch to bill side
          setBillFocused(true);
          setSelectedBillIndex(0);
          searchRef.current?.blur();
        }
        return;
      }

      // === BILL FOCUSED: arrow keys navigate bill items ===
      if (billFocused && billItems.length > 0) {
        if (e.key === "ArrowDown") { e.preventDefault(); setSelectedBillIndex((p) => Math.min(billItems.length - 1, p + 1)); return; }
        if (e.key === "ArrowUp") { e.preventDefault(); setSelectedBillIndex((p) => Math.max(0, p - 1)); return; }
        // + key → increase qty
        if ((e.key === "+" || e.key === "=") && selectedBillIndex >= 0) {
          e.preventDefault(); updateBillItem(selectedBillIndex, { qty: billItems[selectedBillIndex].qty + 1 }); return;
        }
        // - key → decrease qty
        if (e.key === "-" && selectedBillIndex >= 0) {
          e.preventDefault(); updateBillItem(selectedBillIndex, { qty: Math.max(1, billItems[selectedBillIndex].qty - 1) }); return;
        }
        // Delete → remove selected item
        if (e.key === "Delete" && selectedBillIndex >= 0) {
          e.preventDefault();
          removeBillItem(selectedBillIndex);
          setSelectedBillIndex((p) => Math.max(0, p - 1));
          if (billItems.length - 1 <= 0) { setBillFocused(false); refocusSearch(); }
          return;
        }
        // Escape → back to search
        if (e.key === "Escape") { e.preventDefault(); setBillFocused(false); setSelectedBillIndex(-1); refocusSearch(); return; }
        return;
      }

      // Don't capture normal typing in inputs (except F-keys above)
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;

      // Delete key → remove last bill item (when not bill-focused)
      if (e.key === "Delete" && billItems.length > 0) {
        e.preventDefault(); removeBillItem(billItems.length - 1); return;
      }

      // "/" key → focus search
      if (e.key === "/") { e.preventDefault(); setBillFocused(false); refocusSearch(); return; }

      // Escape → refocus search
      if (e.key === "Escape") { e.preventDefault(); setBillFocused(false); refocusSearch(); return; }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [activePopup, billItems, billFocused, selectedBillIndex, refocusSearch, receiptData, printReceipt, clearBill, updateBillItem, removeBillItem, radioChecked, cashReceived, grandTotal, discountAmount, subtotal, tableNo, cgst, sgst]);

  // Place order (online → API, offline → queue in IndexedDB)
  const placeOrder = async () => {
    if (billItems.length === 0) { alert("Bill is empty"); return; }

    setSaving(true);
    setOrderError(null);

    const orderItems = billItems.map((item) => {
      const entry = { name: item.name, price: item.unitPrice, amount: item.qty, notes: item.notes || "" };
      if (item.productId && /^[a-fA-F0-9]{24}$/.test(item.productId)) entry.productId = item.productId;
      if (item.variant) entry.selectedVariant = { name: item.variant, price: item.unitPrice };
      return entry;
    });

    const payload = {
      order: orderItems,
      total: subtotal,
      discount: discountAmount,
      grandTotal,
      paymentMethod: radioChecked.charAt(0).toUpperCase() + radioChecked.slice(1),
      tableNo: tableNo || "01",
    };

    const now = new Date();

    // === OFFLINE MODE: queue order locally ===
    if (!navigator.onLine) {
      try {
        const tempId = await queueOrder(payload);
        const count = await getPendingCount();
        setOfflineCount(count);
        setReceiptData({
          id: tempId,
          billNo: tempId,
          invoiceNumber: "Offline — will sync",
          items: orderItems,
          grandTotal, subtotal,
          discount: discountAmount,
          payment: radioChecked,
          date: now.toLocaleDateString("en-IN"),
          time: now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }),
          offline: true,
        });
        setOrderSaved(true);
        setActivePopup("complete");
        playBeep();
      } catch (err) {
        setOrderError("Failed to queue offline order");
      }
      setSaving(false);
      return;
    }

    // === ONLINE MODE: send to API ===
    try {
      const data = await ordersAPI.create(payload);

      setLastOrderId(data.id);
      setReceiptData({
        id: data.id,
        billNo: data.billNo || data.orderNumber || "—",
        invoiceNumber: data.invoiceNumber || data.billNo,
        items: orderItems,
        grandTotal, subtotal,
        discount: discountAmount,
        payment: radioChecked,
        date: now.toLocaleDateString("en-IN"),
        time: now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }),
      });
      setOrderSaved(true);
      setActivePopup("complete");
      setSaving(false);
      playBeep();
    } catch (err) {
      setOrderError(err.message || "Failed to save order");
      setSaving(false);
    }
  };

  const handleLogout = () => {
    clearAuth();
    router.push("/");
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <div className="animate-spin w-10 h-10 border-4 border-coffee border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-gray-600">Loading POS...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  // Category grid — p.type is 1-13, menusType index 0=type1, 1=type2, etc.
  const categoryGrid = menusType.map((cat, idx) => {
    const typeNum = idx + 1; // menusType[0]="Tea" → type=1
    const catProducts = products.filter((p) => p.type === typeNum);
    return { name: cat, count: catProducts.length, emoji: getCategoryEmoji(cat), typeNum };
  });

  const categoryProducts =
    currentCategory !== null
      ? products.filter((p) => p.type === currentCategory + 1)
      : [];

  return (
    <div style={{ display: "flex", height: "100dvh", overflow: "hidden" }} className="bg-gray-50">
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        currentPage={0}
        userRole={userRole}
        setCurrentPage={(page) => {
          setSidebarOpen(false);
          // Page routes
          if (page === 0) { clearBill(); return; }
          if (page === "dashboard") { router.push("/dashboard"); return; }
          if (page === "receipts") { router.push("/viewreceipts"); return; }
          if (page === "kitchen") { router.push("/kitchen"); return; }
          if (page === "reports") { router.push("/reports"); return; }
          if (page === "inventory") { router.push("/inventory"); return; }
          if (page === "cashbook") { router.push("/cashbook"); return; }
          // Old pages that were inline — redirect to dedicated pages if they exist
          if (page === 3) { setActivePopup("products"); return; }
          if (page === 4) { setActivePopup("salesSummary"); return; }
          if (page === 5) { setActivePopup("dailyReport"); return; }
          if (page === 6) { setActivePopup("dailyExpense"); return; }
          // Popups on same page
          if (page === "settings") { setActivePopup("settings"); return; }
          if (page === "tables") { setActivePopup("table"); return; }
          if (page === "shifts") { setActivePopup("shift"); return; }
        }}
        onLogout={handleLogout}
      />

      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          minWidth: 0,
        }}
      >
        {/* TOP BAR */}
        <header className="bg-coffee-dark text-cream px-3 sm:px-4 py-2.5 flex items-center justify-between border-b border-coffee-darker shadow-sm">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="lg:hidden p-2 hover:bg-white/10 rounded-lg transition"
            >
              <Bars4Icon className="w-5 h-5" />
            </button>
            <h1 className="font-display font-bold text-base sm:text-lg">
              POS Terminal
            </h1>
          </div>

          <div className="flex items-center gap-2 sm:gap-4 text-xs sm:text-sm">
            {/* Online/Offline indicator */}
            <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
              isOnline ? "bg-green-500/20 text-green-300" : "bg-red-500/20 text-red-300"
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? "bg-green-400" : "bg-red-400 animate-pulse"}`} />
              {syncing ? "Syncing..." : isOnline ? "Online" : `Offline${offlineCount > 0 ? ` (${offlineCount})` : ""}`}
            </div>
            <div className="hidden sm:flex items-center gap-2">
              <HiUser className="w-4 h-4 opacity-70" />
              <span>{cashier}</span>
            </div>
            {shift && (
              <div className="hidden sm:flex items-center gap-2 text-yellow-300">
                <HiClock className="w-4 h-4" />
                <span>Shift Active</span>
              </div>
            )}
            {tableNo && (
              <div className="flex items-center gap-2 bg-accent text-coffee-dark px-2 py-1 rounded font-semibold">
                Table {tableNo}
              </div>
            )}
          </div>
        </header>

        {/* MAIN CONTENT: 60/40 SPLIT */}
        <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
          {/* LEFT: SEARCH + PRODUCTS (60%) */}
          <div className="flex-1 lg:w-[60%] flex flex-col overflow-hidden border-r border-gray-200 pb-20 lg:pb-0">
            {/* Search Bar */}
            <div className="p-2 sm:p-3 border-b border-gray-100 bg-white">
              <div className="relative">
                <HiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  ref={searchRef}
                  value={searchText}
                  onChange={handleSearchChange}
                  onKeyDown={handleSearchKeyDown}
                  placeholder="Search product or scan barcode..."
                  className="w-full pl-9 pr-3 py-2.5 h-10 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-coffee focus:bg-white outline-none transition"
                  autoFocus
                />
              </div>
            </div>

            {/* Product Area */}
            <div className="flex-1 overflow-y-auto p-2 sm:p-3">
              {searchText ? (
                /* ===== SEARCH RESULTS — max 10, show more button ===== */
                <SearchResultsView
                  filteredProducts={filteredProducts}
                  selectedIndex={selectedIndex}
                  selectProduct={selectProduct}
                />
              ) : currentCategory !== null ? (
                /* ===== CATEGORY PRODUCTS — arrows + Enter + Backspace ===== */
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <button onClick={() => { setCurrentCategory(null); setSelectedIndex(0); }}
                      className="flex items-center gap-1 text-xs font-semibold text-coffee hover:underline">
                      ← All Categories
                    </button>
                    <span className="text-[9px] text-gray-400">Arrows to select, Enter to add, Backspace to go back</span>
                  </div>
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-4 xl:grid-cols-5 gap-1.5 sm:gap-2">
                    {categoryProducts.map((product, idx) => (
                      <ProductCard key={product._id} product={product} isSelected={selectedIndex === idx} onClick={() => selectProduct(product)} />
                    ))}
                  </div>
                  {categoryProducts.length === 0 && (
                    <p className="text-center text-gray-400 text-sm py-8">No products in this category</p>
                  )}
                </div>
              ) : (
                /* ===== CATEGORY GRID — arrow keys + Enter to navigate ===== */
                <div>
                  <p className="text-[9px] text-gray-400 mb-1">Arrow keys to select, Enter to open, 1-9 quick select</p>
                  <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-4 gap-1.5 sm:gap-2">
                    {categoryGrid.map((cat, idx) => (
                      <button
                        key={cat.name}
                        onClick={() => { setCurrentCategory(idx); setSelectedIndex(0); }}
                        className={`flex flex-col items-center justify-center p-2.5 sm:p-3 bg-white border-2 rounded-lg hover:shadow-md transition ${
                          selectedIndex === idx ? "border-coffee ring-2 ring-coffee/30 shadow-md" : "border-gray-200 hover:border-gray-300"
                        }`}
                      >
                        <span className="text-xl sm:text-2xl">{cat.emoji}</span>
                        <span className="font-semibold text-[10px] sm:text-xs text-gray-900 mt-1 text-center leading-tight">{cat.name}</span>
                        <span className="text-[9px] sm:text-[10px] text-gray-400 mt-0.5">{cat.count}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Shortcut Bar */}
            <div className="hidden sm:flex border-t border-gray-200 bg-gray-50 px-2 py-1 gap-1 text-[9px] text-gray-500 flex-wrap">
              <span className="bg-gray-200 px-1.5 py-0.5 rounded">F1 Clear</span>
              <span className="bg-gray-200 px-1.5 py-0.5 rounded">F2 Hold</span>
              <span className="bg-gray-200 px-1.5 py-0.5 rounded">F5 Pay</span>
              <span className="bg-gray-200 px-1.5 py-0.5 rounded">F9 Table</span>
              <span className="bg-gray-200 px-1.5 py-0.5 rounded">F12 Shift</span>
            </div>
          </div>

          {/* RIGHT: BILL AREA (40%) - DESKTOP ONLY */}
          <div className="hidden lg:flex lg:w-[40%] flex-col bg-white border-l border-gray-200">
            <BillArea
              billItems={billItems}
              subtotal={subtotal}
              discountAmount={discountAmount}
              cgst={cgst}
              sgst={sgst}
              grandTotal={grandTotal}
              tableNo={tableNo}
              orderType={orderType}
              shopSettings={shopSettings}
              removeBillItem={removeBillItem}
              updateBillItem={updateBillItem}
              selectedBillIndex={selectedBillIndex}
              billFocused={billFocused}
              onPay={() => billItems.length > 0 && setActivePopup("payment")}
              onDiscount={() => setActivePopup("discount")}
              onTable={() => setActivePopup("table")}
            />
          </div>

          {/* MOBILE BILL BAR */}
          <div
            className="lg:hidden fixed bottom-0 left-0 right-0 bg-coffee-dark text-cream px-3 py-3 flex justify-between items-center z-20 border-t border-coffee-darker"
            onClick={() => setActivePopup("mobileBill")}
          >
            <span className="text-sm font-semibold">{billItems.length} items</span>
            <span className="text-base font-bold">₹{grandTotal.toFixed(0)}</span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (billItems.length > 0) setActivePopup("payment");
              }}
              className="bg-green-500 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-green-600 transition"
            >
              PAY
            </button>
          </div>
        </div>
      </div>

      {/* POPUPS */}

      {/* ADD ITEM QTY POPUP — opens when product clicked/Enter */}
      {activePopup === "addItem" && pendingProduct && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={cancelAddItem}>
          <div className="bg-white rounded-2xl p-5 w-full max-w-[360px] shadow-xl" onClick={(e) => e.stopPropagation()}>
            {/* Product info */}
            <div className="flex items-center gap-3 mb-4">
              <div className="w-14 h-14 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
                {pendingProduct.imageUrl ? (
                  <img src={pendingProduct.imageUrl.includes("imagekit.io") ? `${pendingProduct.imageUrl}${pendingProduct.imageUrl.includes("?") ? "&" : "?"}tr=w-120,h-120` : pendingProduct.imageUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-2xl text-gray-300">☕</div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm text-gray-900 truncate">{pendingProduct.name}</p>
                <p className="text-coffee font-bold text-base">₹{pendingProduct.price}</p>
              </div>
              <button onClick={cancelAddItem} className="p-1 hover:bg-gray-100 rounded-lg self-start">
                <HiX className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            {/* Quantity */}
            <div className="mb-4">
              <label className="block text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">Quantity</label>
              <div className="flex items-center justify-center gap-3">
                <button onClick={() => setPendingQty((q) => Math.max(1, q - 1))}
                  className="w-12 h-12 flex items-center justify-center rounded-xl bg-gray-100 hover:bg-red-50 hover:text-red-500 transition font-bold text-xl active:scale-95 select-none">−</button>
                <input type="number" value={pendingQty} onChange={(e) => setPendingQty(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-20 h-12 text-center text-2xl font-bold border-2 border-gray-200 rounded-xl focus:border-coffee focus:ring-2 focus:ring-coffee/20 outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" autoFocus
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); confirmAddToBill(); } if (e.key === "Escape") cancelAddItem(); }} />
                <button onClick={() => setPendingQty((q) => q + 1)}
                  className="w-12 h-12 flex items-center justify-center rounded-xl bg-gray-100 hover:bg-green-50 hover:text-green-500 transition font-bold text-xl active:scale-95 select-none">+</button>
              </div>
            </div>

            {/* Notes */}
            <div className="mb-4">
              <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase">Notes (optional)</label>
              <input type="text" value={pendingNotes} onChange={(e) => setPendingNotes(e.target.value)}
                placeholder="No sugar, extra hot..."
                className="w-full px-3 py-2 h-9 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-coffee outline-none"
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); confirmAddToBill(); } if (e.key === "Escape") cancelAddItem(); }} />
            </div>

            {/* Total + Add button */}
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-gray-500">Total:</span>
              <span className="text-xl font-bold text-coffee">₹{(pendingProduct.price * pendingQty).toFixed(0)}</span>
            </div>
            <button onClick={confirmAddToBill}
              className="w-full py-3 bg-green-500 hover:bg-green-600 text-white font-bold rounded-xl transition text-sm">
              Add to Bill — ₹{(pendingProduct.price * pendingQty).toFixed(0)}
            </button>
          </div>
        </div>
      )}

      {activePopup === "payment" && (
        <PaymentPopup
          billItems={billItems}
          grandTotal={grandTotal}
          radioChecked={radioChecked}
          setRadioChecked={setRadioChecked}
          cashReceived={cashReceived}
          setCashReceived={setCashReceived}
          onClose={() => setActivePopup(null)}
          onPay={placeOrder}
          saving={saving}
        />
      )}

      {activePopup === "complete" && (
        <OrderCompletePopup
          receiptData={receiptData}
          onNewOrder={() => {
            clearBill();
            setActivePopup(null);
          }}
          onPrint={() => printReceipt(receiptData)}
        />
      )}

      {activePopup === "table" && (
        <TablePopup
          tables={tables}
          tableNo={tableNo}
          setTableNo={setTableNo}
          onClose={() => setActivePopup(null)}
        />
      )}

      {activePopup === "customer" && (
        <CustomerPopup
          customer={customer}
          setCustomer={setCustomer}
          onClose={() => setActivePopup(null)}
        />
      )}

      {activePopup === "discount" && (
        <DiscountPopup
          discountAmount={discountAmount}
          setDiscountAmount={setDiscountAmount}
          discountCode={discountCode}
          setDiscountCode={setDiscountCode}
          subtotal={subtotal}
          onClose={() => setActivePopup(null)}
        />
      )}

      {activePopup === "mobileBill" && (
        <MobileBillPopup
          billItems={billItems}
          subtotal={subtotal}
          discountAmount={discountAmount}
          cgst={cgst}
          sgst={sgst}
          grandTotal={grandTotal}
          removeBillItem={removeBillItem}
          updateBillItem={updateBillItem}
          onClose={() => setActivePopup(null)}
          onPay={() => {
            setActivePopup("payment");
          }}
        />
      )}

      {activePopup === "held" && (
        <HeldOrdersPopup onClose={() => setActivePopup(null)} />
      )}

      {activePopup === "shift" && (
        <ShiftPopup shift={shift} onClose={() => setActivePopup(null)} />
      )}

      {activePopup === "settings" && (
        <SettingsPopup onClose={() => setActivePopup(null)} onSave={(s) => { if (s) setShopSettings(s); }} />
      )}

      {activePopup === "products" && (
        <ProductsPopup onClose={() => { setActivePopup(null); refocusSearch(); }} onProductsChanged={() => {
          productsAPI.getAll({ available: true }).then((prods) => {
            setProducts(prods.map((p) => ({ ...p, imageUrl: cleanUrl(p.imageUrl) })));
          });
        }} />
      )}

      {activePopup === "salesSummary" && <SalesSummaryPopup onClose={() => setActivePopup(null)} />}
      {activePopup === "dailyReport" && <DailyReportPopup onClose={() => setActivePopup(null)} />}
      {activePopup === "dailyExpense" && <DailyExpensePopup onClose={() => setActivePopup(null)} />}
    </div>
  );
}

// HELPER FUNCTIONS

function getCategoryEmoji(category) {
  const emojiMap = {
    Tea: "🍵",
    Coffee: "☕",
    "Dairy Products": "🥛",
    Snacks: "🥪",
    "Evening Special": "🌙",
    "Fresh Juice": "🧃",
    "Cool Drinks": "🧊",
    "Ice Cream": "🍦",
    "Karupatti Ice Cream": "🍨",
    "Karupatti Snacks": "🥜",
    "Other Snacks": "🍿",
    "Biscuits & Cakes": "🍰",
    Parcel: "📦",
  };
  return emojiMap[category] || "🍽️";
}

// BILL AREA COMPONENT

function BillArea({
  billItems,
  subtotal,
  discountAmount,
  cgst,
  sgst,
  grandTotal,
  tableNo,
  orderType,
  shopSettings,
  removeBillItem,
  updateBillItem,
  selectedBillIndex,
  billFocused,
  onPay,
  onDiscount,
  onTable,
}) {
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-3 border-b border-gray-200 bg-gray-50">
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-gray-900">Current Bill</h2>
          {billFocused && <span className="text-[9px] bg-coffee text-white px-2 py-0.5 rounded-full animate-pulse">BILL MODE — ↑↓ +/- Del | Tab to exit</span>}
        </div>
        <div className="flex gap-4 mt-1 text-xs text-gray-600">
          {tableNo && <span className="font-semibold">Table: {tableNo}</span>}
          <span>{orderType}</span>
          {!billFocused && billItems.length > 0 && <span className="text-gray-400">Tab to edit bill</span>}
        </div>
      </div>

      {/* Items */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {billItems.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-400">
            <p>No items added</p>
          </div>
        ) : (
          billItems.map((item, idx) => (
            <div
              key={item.id}
              className={`p-2 rounded-lg border transition ${
                billFocused && selectedBillIndex === idx
                  ? "bg-coffee/10 border-coffee ring-2 ring-coffee/30 shadow-md"
                  : "bg-gray-50 border-gray-200"
              }`}
            >
              <div className="flex justify-between items-start mb-2">
                <div className="flex-1">
                  <p className="font-semibold text-sm text-gray-900">
                    {item.name}
                    {item.variant && (
                      <span className="text-xs text-gray-500 ml-1">
                        ({item.variant})
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-gray-500">
                    ₹{item.unitPrice} x {item.qty}
                  </p>
                </div>
                <p className="font-bold text-coffee">₹{item.itemTotal.toFixed(0)}</p>
              </div>

              {item.notes && (
                <p className="text-xs text-gray-600 mb-2">Note: {item.notes}</p>
              )}

              <div className="flex items-center gap-2">
                <button
                  onClick={() =>
                    updateBillItem(idx, { qty: Math.max(1, item.qty - 1) })
                  }
                  className="p-1 hover:bg-gray-200 rounded transition"
                >
                  <HiMinus className="w-3 h-3 text-gray-600" />
                </button>
                <input
                  type="number"
                  value={item.qty}
                  onChange={(e) =>
                    updateBillItem(idx, { qty: Math.max(1, parseInt(e.target.value) || 1) })
                  }
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === "Escape") { e.preventDefault(); e.target.blur(); } }}
                  className="w-8 text-center text-xs border border-gray-200 rounded p-1"
                />
                <button
                  onClick={() => updateBillItem(idx, { qty: item.qty + 1 })}
                  className="p-1 hover:bg-gray-200 rounded transition"
                >
                  <HiPlus className="w-3 h-3 text-gray-600" />
                </button>
                <button
                  onClick={() => removeBillItem(idx)}
                  className="ml-auto p-1 hover:bg-red-100 rounded transition"
                >
                  <HiTrash className="w-3 h-3 text-red-500" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Totals */}
      <div className="border-t border-gray-200 p-3 bg-gray-50 space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">Subtotal:</span>
          <span className="font-semibold">₹{subtotal.toFixed(0)}</span>
        </div>
        {discountAmount > 0 && (
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Discount:</span>
            <span className="font-semibold text-green-600">-₹{discountAmount.toFixed(0)}</span>
          </div>
        )}
        {shopSettings?.taxEnabled && !shopSettings?.inclusiveTax && (cgst > 0 || sgst > 0) && (
          <>
            <div className="flex justify-between text-xs text-gray-600">
              <span>CGST ({shopSettings.cgstRate}%):</span>
              <span>₹{cgst.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-xs text-gray-600">
              <span>SGST ({shopSettings.sgstRate}%):</span>
              <span>₹{sgst.toFixed(2)}</span>
            </div>
          </>
        )}
        {shopSettings?.taxEnabled && shopSettings?.inclusiveTax && subtotal > 0 && (
          <div className="text-[10px] text-gray-400 text-right">
            (Incl. CGST {shopSettings.cgstRate}% + SGST {shopSettings.sgstRate}%)
          </div>
        )}
        <div className="flex justify-between text-base font-bold border-t border-gray-300 pt-2">
          <span>Grand Total:</span>
          <span className="text-coffee">₹{grandTotal.toFixed(0)}</span>
        </div>
      </div>

      {/* Actions */}
      <div className="p-3 space-y-2 border-t border-gray-200">
        <button
          onClick={onPay}
          disabled={billItems.length === 0}
          className="w-full py-3 bg-green-500 text-white font-bold rounded-lg hover:bg-green-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          PAY (F5)
        </button>
        <button
          onClick={onDiscount}
          className="w-full py-2 border border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-50 transition text-sm"
        >
          Discount
        </button>
        <button
          onClick={onTable}
          className="w-full py-2 border border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-50 transition text-sm"
        >
          Table (F9)
        </button>
      </div>
    </div>
  );
}

// PAYMENT POPUP — auto-fills bill total, full keyboard access

function PaymentPopup({
  billItems,
  grandTotal,
  radioChecked,
  setRadioChecked,
  cashReceived,
  setCashReceived,
  onClose,
  onPay,
  saving,
}) {
  const cashInputRef = useRef(null);
  const popupRef = useRef(null);

  // Auto-fill cash received on mount
  useEffect(() => {
    setCashReceived(String(Math.ceil(grandTotal)));
    // Focus cash input after state update
    const timer = setTimeout(() => {
      if (cashInputRef.current) {
        cashInputRef.current.focus();
        cashInputRef.current.select();
      }
    }, 80);
    return () => clearTimeout(timer);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Focus cash input when switching to cash, or popup div for UPI/Card keyboard shortcuts
  useEffect(() => {
    const timer = setTimeout(() => {
      if (radioChecked === "cash" && cashInputRef.current) {
        cashInputRef.current.focus();
        cashInputRef.current.select();
      } else if (popupRef.current) {
        popupRef.current.focus();
      }
    }, 50);
    return () => clearTimeout(timer);
  }, [radioChecked]);

  const received = parseFloat(cashReceived || 0);
  const change = Math.max(0, received - grandTotal);
  const isShort = received < grandTotal;

  // Denomination breakdown for change
  const getChangeBreakdown = (amt) => {
    if (amt <= 0) return [];
    const denoms = [2000, 500, 200, 100, 50, 20, 10, 5, 2, 1];
    const result = [];
    let remaining = Math.round(amt);
    for (const d of denoms) {
      if (remaining >= d) {
        const count = Math.floor(remaining / d);
        result.push({ denom: d, count });
        remaining -= count * d;
      }
    }
    return result;
  };

  // Keyboard handler for entire popup
  const handlePopupKeyDown = (e) => {
    // 1/2/3 → select payment method (only when not typing in input)
    if (e.target.tagName !== "INPUT") {
      if (e.key === "1") { e.preventDefault(); setRadioChecked("cash"); return; }
      if (e.key === "2") { e.preventDefault(); setRadioChecked("upi"); return; }
      if (e.key === "3") { e.preventDefault(); setRadioChecked("card"); return; }
      // Enter → complete payment (only from outside input — input has its own handler)
      if (e.key === "Enter") {
        e.preventDefault();
        if (!saving && !(radioChecked === "cash" && isShort)) onPay();
        return;
      }
    }
    // Escape → close
    if (e.key === "Escape") { e.preventDefault(); onClose(); return; }
  };

  const changeBreakdown = getChangeBreakdown(change);

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end lg:items-center justify-center p-0 lg:p-4" onKeyDown={handlePopupKeyDown} data-popup="payment" tabIndex={-1} ref={popupRef}>
      <div className="bg-white w-full lg:w-[480px] rounded-t-2xl lg:rounded-2xl p-4 sm:p-5 max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4">
          <div>
            <h2 className="text-xl font-bold">Payment</h2>
            <p className="text-xs text-gray-400 mt-0.5">Press 1=Cash 2=UPI 3=Card | Enter=Pay | Esc=Cancel</p>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg"><HiX className="w-5 h-5" /></button>
        </div>

        {/* Grand Total */}
        <div className="bg-coffee-dark text-cream text-center py-3 rounded-xl mb-4">
          <p className="text-xs opacity-70">Total Amount</p>
          <p className="text-3xl font-bold font-mono">₹{grandTotal.toFixed(0)}</p>
        </div>

        {/* Payment Methods — 3 buttons in a row */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          {[
            { id: "cash", label: "1. Cash", icon: HiCash },
            { id: "upi", label: "2. UPI", icon: HiDeviceMobile },
            { id: "card", label: "3. Card", icon: HiCreditCard },
          ].map((method) => (
            <button
              key={method.id}
              onClick={() => setRadioChecked(method.id)}
              className={`flex flex-col items-center gap-1 p-3 rounded-xl border-2 transition font-semibold text-sm ${
                radioChecked === method.id
                  ? "border-coffee bg-coffee/10 text-coffee-dark"
                  : "border-gray-200 text-gray-600 hover:border-gray-300"
              }`}
            >
              <method.icon className="w-6 h-6" />
              <span className="text-xs">{method.label}</span>
            </button>
          ))}
        </div>

        {/* Cash Calculator — only when Cash selected */}
        {radioChecked === "cash" && (
          <div className="p-3 bg-gray-50 rounded-xl mb-4 space-y-3">
            <div>
              <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase">Cash Received</label>
              <input
                ref={cashInputRef}
                type="number"
                inputMode="decimal"
                value={cashReceived}
                onChange={(e) => setCashReceived(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); e.stopPropagation(); if (!isShort) onPay(); } }}
                className="w-full p-3 border-2 border-gray-300 rounded-xl text-2xl font-bold text-center focus:ring-2 focus:ring-coffee focus:border-coffee outline-none"
              />
            </div>

            {/* Quick denomination buttons */}
            <div className="grid grid-cols-6 gap-1.5">
              {[10, 20, 50, 100, 200, 500].map((amt) => (
                <button key={amt} onClick={() => setCashReceived(String(received + amt))}
                  className="py-2 bg-white border border-gray-200 rounded-lg text-xs font-bold text-gray-700 hover:bg-gray-100 transition">
                  +₹{amt}
                </button>
              ))}
            </div>

            {/* Exact amount button */}
            <button onClick={() => setCashReceived(String(Math.ceil(grandTotal)))}
              className="w-full py-2 bg-coffee/10 text-coffee rounded-lg text-xs font-bold hover:bg-coffee/20 transition">
              Exact Amount ₹{Math.ceil(grandTotal)}
            </button>

            {/* Change display */}
            <div className="border-t border-gray-200 pt-3 space-y-1.5">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Bill:</span>
                <span className="font-bold">₹{grandTotal.toFixed(0)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Received:</span>
                <span className="font-bold">₹{received.toFixed(0)}</span>
              </div>
              <div className={`flex justify-between text-base font-bold border-t border-gray-200 pt-1.5 ${isShort ? "text-red-500" : "text-green-600"}`}>
                <span>{isShort ? "Short:" : "Change:"}</span>
                <span>₹{isShort ? (grandTotal - received).toFixed(0) : change.toFixed(0)}</span>
              </div>
              {/* Denomination breakdown */}
              {change > 0 && changeBreakdown.length > 0 && (
                <p className="text-[10px] text-gray-400 text-right">
                  {changeBreakdown.map((d) => `₹${d.denom}×${d.count}`).join(" + ")}
                </p>
              )}
              {received === grandTotal && (
                <p className="text-center text-green-600 text-xs font-bold">Exact Amount</p>
              )}
            </div>
          </div>
        )}

        {/* UPI/Card — simple confirm */}
        {radioChecked !== "cash" && (
          <div className="p-4 bg-gray-50 rounded-xl mb-4 text-center">
            <p className="text-sm text-gray-600 mb-1">Pay ₹{grandTotal.toFixed(0)} via <span className="font-bold uppercase">{radioChecked}</span></p>
            <p className="text-xs text-gray-400">Press Enter to confirm</p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-2">
          <button onClick={onClose}
            className="flex-1 py-3 border border-gray-300 text-gray-700 font-bold rounded-xl hover:bg-gray-50 transition text-sm">
            Cancel (Esc)
          </button>
          <button onClick={onPay}
            disabled={saving || (radioChecked === "cash" && isShort)}
            className="flex-1 py-3 bg-green-500 text-white font-bold rounded-xl hover:bg-green-600 transition disabled:opacity-40 disabled:cursor-not-allowed text-sm">
            {saving ? "Processing..." : "Complete (Enter)"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ORDER COMPLETE POPUP — full keyboard: P=Print, W=WhatsApp, Enter/Space=New Order

function OrderCompletePopup({ receiptData, onNewOrder, onPrint }) {
  const popupRef = useRef(null);

  // Focus popup on mount for keyboard
  useEffect(() => {
    popupRef.current?.focus();
  }, []);

  // Keyboard handler
  const handleKey = (e) => {
    if (e.key === "p" || e.key === "P") { e.preventDefault(); onPrint(); return; }
    if (e.key === "w" || e.key === "W") {
      e.preventDefault();
      const msg = encodeURIComponent(`Receipt from Karupatti Coffee\nBill: ${receiptData?.billNo}\nTotal: ₹${receiptData?.grandTotal?.toFixed(0)}\nView: ${window.location.origin}/receipt/${receiptData?.id}`);
      window.open(`https://wa.me/?text=${msg}`, "_blank");
      return;
    }
    if (e.key === "Enter" || e.key === " " || e.key === "Escape") { e.preventDefault(); onNewOrder(); return; }
  };

  const items = receiptData?.items || [];

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-3 sm:p-4" onKeyDown={handleKey} tabIndex={-1} ref={popupRef}>
      <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl" onClick={(e) => e.stopPropagation()}>
        {/* Success header */}
        <div className="bg-green-500 text-white px-5 py-4 text-center">
          <HiCheckCircle className="w-12 h-12 mx-auto mb-1" />
          <h2 className="text-xl font-bold">Order Placed!</h2>
        </div>

        {/* Order info */}
        <div className="px-5 py-3 border-b border-gray-100">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-xs text-gray-500">Bill Number</p>
              <p className="font-bold text-base text-gray-900 font-mono">{receiptData?.billNo || "—"}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-500">Invoice</p>
              <p className="font-semibold text-sm text-gray-700 font-mono">{receiptData?.invoiceNumber || "—"}</p>
            </div>
          </div>
          <div className="flex justify-between mt-2 text-xs text-gray-500">
            <span>{receiptData?.date} {receiptData?.time}</span>
            <span className="uppercase font-semibold">{receiptData?.payment}</span>
          </div>
        </div>

        {/* Items */}
        <div className="px-5 py-3 max-h-[200px] overflow-y-auto">
          {items.map((item, i) => (
            <div key={i} className="flex justify-between py-1 text-sm border-b border-gray-50 last:border-0">
              <span className="text-gray-700">{item.name} <span className="text-gray-400">×{item.amount || item.qty || 1}</span></span>
              <span className="font-semibold text-gray-900">₹{(item.price * (item.amount || item.qty || 1)).toFixed(0)}</span>
            </div>
          ))}
        </div>

        {/* Total */}
        <div className="px-5 py-3 bg-gray-50 border-t border-gray-200">
          {receiptData?.discount > 0 && (
            <div className="flex justify-between text-sm text-green-600 mb-1">
              <span>Discount</span><span>-₹{receiptData.discount.toFixed(0)}</span>
            </div>
          )}
          <div className="flex justify-between text-lg font-bold">
            <span>Grand Total</span>
            <span className="text-coffee">₹{receiptData?.grandTotal?.toFixed(0)}</span>
          </div>
        </div>

        {/* Buttons */}
        <div className="px-5 py-4 flex gap-2">
          <button onClick={onPrint}
            className="flex-1 py-2.5 border-2 border-coffee text-coffee font-bold rounded-xl hover:bg-coffee/10 transition flex items-center justify-center gap-1.5 text-sm">
            <HiPrinter className="w-4 h-4" /> [P] Print
          </button>
          <button onClick={() => {
            const msg = encodeURIComponent(`Receipt from Karupatti Coffee\nBill: ${receiptData?.billNo}\nTotal: ₹${receiptData?.grandTotal?.toFixed(0)}\nView: ${window.location.origin}/receipt/${receiptData?.id}`);
            window.open(`https://wa.me/?text=${msg}`, "_blank");
          }}
            className="flex-1 py-2.5 border-2 border-green-500 text-green-600 font-bold rounded-xl hover:bg-green-50 transition flex items-center justify-center gap-1.5 text-sm">
            <HiShare className="w-4 h-4" /> [W] Share
          </button>
          <button onClick={onNewOrder}
            className="flex-1 py-2.5 bg-coffee text-white font-bold rounded-xl hover:bg-coffee-dark transition text-sm">
            [Enter] New
          </button>
        </div>

        {/* Keyboard hint */}
        <div className="px-5 pb-3 text-center">
          <p className="text-[9px] text-gray-400">P=Print | W=WhatsApp | Enter=New Order</p>
        </div>
      </div>
    </div>
  );
}

// TABLE POPUP

function TablePopup({ tables, tableNo, setTableNo, onClose }) {
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end lg:items-center justify-center p-4 lg:p-0" data-popup="table" onKeyDown={(e) => { if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); onClose(); } }} tabIndex={-1} ref={(el) => el?.focus()}>
      <div className="bg-white rounded-t-2xl lg:rounded-2xl p-6 w-full lg:max-w-[500px]" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold">Select Table</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg">
            <HiX className="w-6 h-6" />
          </button>
        </div>

        <div className="grid grid-cols-4 gap-3 mb-6">
          {tables.map((table) => (
            <button
              key={table._id}
              onClick={() => {
                setTableNo(table.tableNumber);
                onClose();
              }}
              className={`p-4 rounded-lg font-bold transition ${
                tableNo === String(table.tableNumber)
                  ? "bg-coffee text-white"
                  : "bg-gray-100 text-gray-900 hover:bg-gray-200"
              }`}
            >
              {table.tableNumber}
            </button>
          ))}
        </div>

        <button
          onClick={onClose}
          className="w-full py-3 bg-gray-200 text-gray-900 font-bold rounded-lg hover:bg-gray-300 transition"
        >
          Close
        </button>
      </div>
    </div>
  );
}

// CUSTOMER POPUP

function CustomerPopup({ customer, setCustomer, onClose }) {
  const [phone, setPhone] = useState("");

  const handleSearch = async () => {
    if (!phone) return;
    try {
      const result = await customersAPI.search({ phone });
      if (result.length > 0) {
        setCustomer(result[0]);
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end lg:items-center justify-center p-4 lg:p-0" data-popup="customer" onKeyDown={(e) => { if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); onClose(); } }} tabIndex={-1} ref={(el) => el?.focus()}>
      <div className="bg-white rounded-t-2xl lg:rounded-2xl p-6 w-full lg:max-w-[500px]" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold">Customer</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg">
            <HiX className="w-6 h-6" />
          </button>
        </div>

        {customer ? (
          <div className="mb-6 p-4 bg-gray-50 rounded-lg">
            <p className="font-semibold">{customer.name}</p>
            <p className="text-sm text-gray-600">{customer.phone}</p>
          </div>
        ) : (
          <div className="mb-6 space-y-3">
            <input
              type="text"
              placeholder="Phone number"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleSearch(); } }}
              className="w-full p-2.5 border border-gray-300 rounded-lg"
              autoFocus
            />
            <button
              onClick={handleSearch}
              className="w-full py-2.5 bg-coffee text-white font-bold rounded-lg hover:bg-coffee-dark transition"
            >
              Search Customer
            </button>
          </div>
        )}

        <button
          onClick={onClose}
          className="w-full py-3 bg-gray-200 text-gray-900 font-bold rounded-lg hover:bg-gray-300 transition"
        >
          Close
        </button>
      </div>
    </div>
  );
}

// DISCOUNT POPUP

function DiscountPopup({
  discountAmount,
  setDiscountAmount,
  discountCode,
  setDiscountCode,
  subtotal,
  onClose,
}) {
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end lg:items-center justify-center p-4 lg:p-0" data-popup="discount" onKeyDown={(e) => { if (e.key === "Escape" || e.key === "Enter") { e.preventDefault(); e.stopPropagation(); onClose(); } }} tabIndex={-1} ref={(el) => el?.focus()}>
      <div className="bg-white rounded-t-2xl lg:rounded-2xl p-6 w-full lg:max-w-[500px]" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold">Discount</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg">
            <HiX className="w-6 h-6" />
          </button>
        </div>

        <div className="space-y-4 mb-6">
          <div>
            <label className="block text-sm font-semibold mb-2">
              Discount Code:
            </label>
            <input
              type="text"
              value={discountCode}
              onChange={(e) => setDiscountCode(e.target.value)}
              placeholder="Enter code"
              className="w-full p-2.5 border border-gray-300 rounded-lg"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold mb-2">
              Discount Amount (₹):
            </label>
            <input
              type="number"
              value={discountAmount}
              onChange={(e) =>
                setDiscountAmount(Math.min(subtotal, parseFloat(e.target.value) || 0))
              }
              max={subtotal}
              className="w-full p-2.5 border border-gray-300 rounded-lg"
            />
          </div>

          <div className="flex gap-2">
            {[10, 50, 100, 200].map((amt) => (
              <button
                key={amt}
                onClick={() =>
                  setDiscountAmount(Math.min(subtotal, discountAmount + amt))
                }
                className="flex-1 py-2 bg-gray-100 text-gray-900 font-bold rounded-lg hover:bg-gray-200 transition text-sm"
              >
                +₹{amt}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={onClose}
          className="w-full py-3 bg-coffee text-white font-bold rounded-lg hover:bg-coffee-dark transition"
        >
          Apply Discount
        </button>
      </div>
    </div>
  );
}

// HELD ORDERS POPUP

function HeldOrdersPopup({ onClose }) {
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end lg:items-center justify-center p-4 lg:p-0" data-popup="held" onKeyDown={(e) => { if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); onClose(); } }} tabIndex={-1} ref={(el) => el?.focus()}>
      <div className="bg-white rounded-t-2xl lg:rounded-2xl p-6 w-full lg:max-w-[500px]" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold">Held Orders</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg">
            <HiX className="w-6 h-6" />
          </button>
        </div>

        <div className="text-center py-8 text-gray-400">
          <p className="text-sm">No held orders</p>
        </div>

        <button
          onClick={onClose}
          className="w-full py-3 bg-gray-200 text-gray-900 font-bold rounded-lg hover:bg-gray-300 transition"
        >
          Close
        </button>
      </div>
    </div>
  );
}

// SHIFT POPUP

function ShiftPopup({ shift, onClose }) {
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end lg:items-center justify-center p-4 lg:p-0" data-popup="shift" onKeyDown={(e) => { if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); onClose(); } }} tabIndex={-1} ref={(el) => el?.focus()}>
      <div className="bg-white rounded-t-2xl lg:rounded-2xl p-6 w-full lg:max-w-[500px]" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold">Shift Info</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg">
            <HiX className="w-6 h-6" />
          </button>
        </div>

        {shift ? (
          <div className="p-4 bg-gray-50 rounded-lg mb-6">
            <p className="text-sm text-gray-600">
              <span className="font-semibold">Started:</span>{" "}
              {new Date(shift.startTime).toLocaleString()}
            </p>
            <p className="text-sm text-gray-600 mt-2">
              <span className="font-semibold">Status:</span> Active
            </p>
          </div>
        ) : (
          <div className="text-center py-8 text-gray-400">
            <p className="text-sm">No active shift</p>
          </div>
        )}

        <button
          onClick={onClose}
          className="w-full py-3 bg-gray-200 text-gray-900 font-bold rounded-lg hover:bg-gray-300 transition"
        >
          Close
        </button>
      </div>
    </div>
  );
}

// MOBILE BILL POPUP

function MobileBillPopup({
  billItems,
  subtotal,
  discountAmount,
  cgst,
  sgst,
  grandTotal,
  removeBillItem,
  updateBillItem,
  onClose,
  onPay,
}) {
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center p-0" data-popup="mobileBill" onKeyDown={(e) => { if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); onClose(); } }} tabIndex={-1} ref={(el) => el?.focus()}>
      <div className="bg-white w-full rounded-t-2xl p-4 max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">Current Bill</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg">
            <HiX className="w-6 h-6" />
          </button>
        </div>

        {/* Items */}
        <div className="space-y-2 mb-4">
          {billItems.map((item, idx) => (
            <div
              key={item.id}
              className="p-2 bg-gray-50 rounded-lg border border-gray-200"
            >
              <div className="flex justify-between items-start mb-2">
                <div className="flex-1">
                  <p className="font-semibold text-sm text-gray-900">
                    {item.name}
                  </p>
                  <p className="text-xs text-gray-500">
                    ₹{item.unitPrice} x {item.qty}
                  </p>
                </div>
                <p className="font-bold text-coffee">₹{item.itemTotal.toFixed(0)}</p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() =>
                    updateBillItem(idx, { qty: Math.max(1, item.qty - 1) })
                  }
                  className="p-1 hover:bg-gray-200 rounded"
                >
                  <HiMinus className="w-3 h-3 text-gray-600" />
                </button>
                <input
                  type="number"
                  value={item.qty}
                  onChange={(e) =>
                    updateBillItem(idx, { qty: Math.max(1, parseInt(e.target.value) || 1) })
                  }
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === "Escape") { e.preventDefault(); e.target.blur(); } }}
                  className="w-8 text-center text-xs border border-gray-200 rounded p-1"
                />
                <button
                  onClick={() => updateBillItem(idx, { qty: item.qty + 1 })}
                  className="p-1 hover:bg-gray-200 rounded"
                >
                  <HiPlus className="w-3 h-3 text-gray-600" />
                </button>
                <button
                  onClick={() => removeBillItem(idx)}
                  className="ml-auto p-1 hover:bg-red-100 rounded"
                >
                  <HiTrash className="w-3 h-3 text-red-500" />
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Totals */}
        <div className="border-t border-gray-200 pt-3 space-y-2 mb-4">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Subtotal:</span>
            <span className="font-semibold">₹{subtotal.toFixed(0)}</span>
          </div>
          {discountAmount > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Discount:</span>
              <span className="font-semibold text-green-600">
                -₹{discountAmount.toFixed(0)}
              </span>
            </div>
          )}
          <div className="flex justify-between text-xs text-gray-600">
            <span>CGST ({shopSettings.cgstRate || 0}%):</span>
            <span>₹{cgst.toFixed(0)}</span>
          </div>
          <div className="flex justify-between text-xs text-gray-600">
            <span>SGST ({shopSettings.sgstRate || 0}%):</span>
            <span>₹{sgst.toFixed(0)}</span>
          </div>
          <div className="flex justify-between text-base font-bold border-t border-gray-300 pt-2">
            <span>Grand Total:</span>
            <span className="text-coffee">₹{grandTotal.toFixed(0)}</span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3 border border-gray-300 text-gray-700 font-bold rounded-lg hover:bg-gray-50 transition"
          >
            Back
          </button>
          <button
            onClick={onPay}
            className="flex-1 py-3 bg-green-500 text-white font-bold rounded-lg hover:bg-green-600 transition"
          >
            Pay
          </button>
        </div>
      </div>
    </div>
  );
}

// ===== SEARCH RESULTS — show max 10, then "Show more" =====
function SearchResultsView({ filteredProducts, selectedIndex, selectProduct }) {
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? filteredProducts : filteredProducts.slice(0, 10);
  const hasMore = filteredProducts.length > 10 && !showAll;

  if (filteredProducts.length === 0) {
    return <div className="text-center py-8 text-gray-400"><p className="text-sm">No products found</p></div>;
  }

  return (
    <div>
      {/* Grid view with images */}
      <p className="text-[10px] text-gray-400 mb-1.5">{filteredProducts.length} result{filteredProducts.length !== 1 ? "s" : ""}{hasMore ? ` — showing first 10` : ""}</p>
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-4 xl:grid-cols-5 gap-1.5 sm:gap-2">
        {visible.map((product, idx) => (
          <ProductCard
            key={product._id}
            product={product}
            isSelected={idx === selectedIndex}
            onClick={() => selectProduct(product)}
          />
        ))}
      </div>
      {hasMore && (
        <button
          onClick={() => setShowAll(true)}
          className="mt-2 w-full py-2 text-xs font-semibold text-coffee border border-coffee/30 rounded-lg hover:bg-coffee/5 transition"
        >
          Show all {filteredProducts.length} results
        </button>
      )}
    </div>
  );
}

// ===== PRODUCT CARD — compact with image, proper aspect ratio =====
function ProductCard({ product, onClick, isSelected }) {
  const imgSrc = product.imageUrl
    ? (product.imageUrl.includes("imagekit.io")
        ? `${product.imageUrl}${product.imageUrl.includes("?") ? "&" : "?"}tr=w-200,h-200,c-at_max`
        : product.imageUrl)
    : null;

  return (
    <button
      onClick={onClick}
      className={`flex flex-col bg-white rounded-lg border overflow-hidden transition hover:shadow-md ${
        isSelected ? "border-coffee ring-2 ring-coffee shadow-md" : "border-gray-200 hover:border-gray-300"
      }`}
      style={{ height: "100%" }}
    >
      {/* Image — square aspect ratio */}
      <div className="w-full aspect-square bg-gray-100 overflow-hidden flex-shrink-0">
        {imgSrc ? (
          <img src={imgSrc} alt={product.name} className="w-full h-full object-cover" loading="lazy" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-300 text-2xl">☕</div>
        )}
      </div>
      {/* Info */}
      <div className="flex flex-col flex-1 p-1.5 sm:p-2">
        <p
          className="font-semibold text-[10px] sm:text-xs text-gray-900 leading-tight"
          style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", minHeight: "2.2em" }}
        >
          {product.name}
        </p>
        <div className="flex items-center justify-between mt-auto pt-1">
          <span className="text-[10px] sm:text-xs font-bold text-coffee">₹{product.price}</span>
          <span className="text-[8px] sm:text-[9px] text-gray-400">{categoryMap[product.type] || ""}</span>
        </div>
      </div>
    </button>
  );
}

// SETTINGS POPUP
function SettingsPopup({ onClose, onSave }) {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    settingsAPI.get().then((s) => { setSettings(s); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  const save = async () => {
    setSaving(true); setMsg("");
    try {
      await settingsAPI.update(settings);
      if (onSave) onSave(settings); // Update POS bill immediately
      setMsg("Saved!"); setTimeout(() => setMsg(""), 2000);
    } catch { setMsg("Failed"); }
    finally { setSaving(false); }
  };

  const handleChange = (field, value) => setSettings((s) => ({ ...s, [field]: value }));
  const inputCls = "w-full border border-gray-200 px-3 py-2 h-9 rounded-lg text-sm focus:ring-2 focus:ring-coffee outline-none";

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-3" onKeyDown={(e) => { if (e.key === "Escape") onClose(); }}>
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-white border-b border-gray-200 px-5 py-3 flex justify-between items-center z-10">
          <h2 className="text-lg font-bold">Settings</h2>
          <div className="flex items-center gap-2">
            {msg && <span className={`text-xs font-semibold ${msg === "Saved!" ? "text-green-600" : "text-red-500"}`}>{msg}</span>}
            <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg"><HiX className="w-5 h-5" /></button>
          </div>
        </div>

        {loading || !settings ? (
          <div className="flex items-center justify-center py-16"><div className="w-8 h-8 border-4 border-coffee border-t-transparent rounded-full animate-spin" /></div>
        ) : (
          <div className="p-5 space-y-5">
            {/* Shop Info */}
            <div>
              <h3 className="text-xs font-bold text-gray-500 uppercase mb-2">Shop Info</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div><label className="block text-[10px] font-bold text-gray-400 mb-0.5 uppercase">Name</label><input value={settings.shopName || ""} onChange={(e) => handleChange("shopName", e.target.value)} className={inputCls} /></div>
                <div><label className="block text-[10px] font-bold text-gray-400 mb-0.5 uppercase">Phone</label><input value={settings.shopPhone || ""} onChange={(e) => handleChange("shopPhone", e.target.value)} className={inputCls} /></div>
                <div className="sm:col-span-2"><label className="block text-[10px] font-bold text-gray-400 mb-0.5 uppercase">Address</label><input value={settings.shopAddress || ""} onChange={(e) => handleChange("shopAddress", e.target.value)} className={inputCls} /></div>
                <div><label className="block text-[10px] font-bold text-gray-400 mb-0.5 uppercase">GSTIN</label><input value={settings.gstNumber || ""} onChange={(e) => handleChange("gstNumber", e.target.value)} className={inputCls} /></div>
                <div><label className="block text-[10px] font-bold text-gray-400 mb-0.5 uppercase">FSSAI</label><input value={settings.fssaiNumber || ""} onChange={(e) => handleChange("fssaiNumber", e.target.value)} className={inputCls} /></div>
              </div>
            </div>

            {/* Tax */}
            <div>
              <h3 className="text-xs font-bold text-gray-500 uppercase mb-2">Tax Settings</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div><label className="block text-[10px] font-bold text-gray-400 mb-0.5 uppercase">CGST %</label><input type="number" value={settings.cgstRate || 0} onChange={(e) => handleChange("cgstRate", Number(e.target.value))} className={inputCls} /></div>
                <div><label className="block text-[10px] font-bold text-gray-400 mb-0.5 uppercase">SGST %</label><input type="number" value={settings.sgstRate || 0} onChange={(e) => handleChange("sgstRate", Number(e.target.value))} className={inputCls} /></div>
                <label className="flex items-center gap-2 pt-4"><input type="checkbox" checked={settings.taxEnabled || false} onChange={(e) => handleChange("taxEnabled", e.target.checked)} className="w-4 h-4" /><span className="text-xs">Tax On</span></label>
                <label className="flex items-center gap-2 pt-4"><input type="checkbox" checked={settings.inclusiveTax || false} onChange={(e) => handleChange("inclusiveTax", e.target.checked)} className="w-4 h-4" /><span className="text-xs">Inclusive</span></label>
              </div>
            </div>

            {/* Receipt */}
            <div>
              <h3 className="text-xs font-bold text-gray-500 uppercase mb-2">Receipt</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div><label className="block text-[10px] font-bold text-gray-400 mb-0.5 uppercase">Invoice Prefix</label><input value={settings.invoicePrefix || ""} onChange={(e) => handleChange("invoicePrefix", e.target.value)} className={inputCls} /></div>
                <div><label className="block text-[10px] font-bold text-gray-400 mb-0.5 uppercase">Footer Text</label><input value={settings.receiptFooter || ""} onChange={(e) => handleChange("receiptFooter", e.target.value)} className={inputCls} /></div>
                <label className="flex items-center gap-2"><input type="checkbox" checked={settings.roundOff || false} onChange={(e) => handleChange("roundOff", e.target.checked)} className="w-4 h-4" /><span className="text-xs">Round Off</span></label>
                <label className="flex items-center gap-2"><input type="checkbox" checked={settings.soundEnabled !== false} onChange={(e) => handleChange("soundEnabled", e.target.checked)} className="w-4 h-4" /><span className="text-xs">Sound</span></label>
              </div>
            </div>

            {/* Fixed Daily Expenses */}
            <div>
              <label className="block text-xs font-bold text-gray-500 mb-2 uppercase">Fixed Daily Expenses (Auto-added to Cash Book)</label>
              {(settings.fixedDailyExpenses || []).map((fe, idx) => (
                <div key={idx} className="flex items-center gap-2 mb-2">
                  <input type="text" value={fe.category} placeholder="Category"
                    onChange={(e) => {
                      const updated = [...(settings.fixedDailyExpenses || [])];
                      updated[idx] = { ...updated[idx], category: e.target.value };
                      setSettings({ ...settings, fixedDailyExpenses: updated });
                    }}
                    className="flex-1 px-2 py-1.5 border border-gray-200 rounded-lg text-sm" />
                  <input type="number" value={fe.amount} placeholder="₹"
                    onChange={(e) => {
                      const updated = [...(settings.fixedDailyExpenses || [])];
                      updated[idx] = { ...updated[idx], amount: Number(e.target.value) };
                      setSettings({ ...settings, fixedDailyExpenses: updated });
                    }}
                    className="w-24 px-2 py-1.5 border border-gray-200 rounded-lg text-sm" />
                  <label className="flex items-center gap-1 text-[10px] text-gray-500 whitespace-nowrap">
                    <input type="checkbox" checked={fe.isFund || false}
                      onChange={(e) => {
                        const updated = [...(settings.fixedDailyExpenses || [])];
                        updated[idx] = { ...updated[idx], isFund: e.target.checked };
                        setSettings({ ...settings, fixedDailyExpenses: updated });
                      }}
                      className="w-3.5 h-3.5 rounded border-gray-300 text-purple-600 focus:ring-purple-500" />
                    Fund
                  </label>
                  <button onClick={() => {
                    const updated = (settings.fixedDailyExpenses || []).filter((_, i) => i !== idx);
                    setSettings({ ...settings, fixedDailyExpenses: updated });
                  }} className="text-red-500 hover:text-red-700 p-1"><HiTrash className="w-4 h-4" /></button>
                </div>
              ))}
              <button onClick={() => {
                const updated = [...(settings.fixedDailyExpenses || []), { category: "", amount: 0, active: true, isFund: false }];
                setSettings({ ...settings, fixedDailyExpenses: updated });
              }} className="text-xs text-coffee font-bold hover:underline flex items-center gap-1">
                <HiPlus className="w-3 h-3" /> Add Fixed Expense
              </button>
            </div>

            <button onClick={save} disabled={saving} className="w-full h-10 bg-coffee text-white rounded-lg text-sm font-bold hover:bg-coffee-dark transition disabled:opacity-50">
              {saving ? "Saving..." : "Save Settings"}
            </button>

            {/* Change Password */}
            <ChangePasswordSection />

            {/* Staff Management (admin/owner only) */}
            <StaffManagementSection />
          </div>
        )}
      </div>
    </div>
  );
}

// CHANGE PASSWORD SECTION inside Settings
function ChangePasswordSection() {
  const [oldPass, setOldPass] = useState("");
  const [newPass, setNewPass] = useState("");
  const [confirmPass, setConfirmPass] = useState("");
  const [passMsg, setPassMsg] = useState("");
  const [passLoading, setPassLoading] = useState(false);

  const handleChangePassword = async () => {
    setPassMsg("");
    if (!oldPass || !newPass || !confirmPass) { setPassMsg("All fields required"); return; }
    if (newPass.length < 6) { setPassMsg("Min 6 characters"); return; }
    if (newPass !== confirmPass) { setPassMsg("Passwords don't match"); return; }
    setPassLoading(true);
    try {
      await authAPI.changePassword(oldPass, newPass);
      setPassMsg("Password changed!");
      setOldPass(""); setNewPass(""); setConfirmPass("");
      setTimeout(() => setPassMsg(""), 3000);
    } catch (err) {
      setPassMsg(err.message || "Failed");
    } finally { setPassLoading(false); }
  };

  const ic = "w-full border border-gray-200 px-3 py-2 h-9 rounded-lg text-sm focus:ring-2 focus:ring-coffee outline-none";

  return (
    <div className="border-t border-gray-200 pt-5 mt-2">
      <h3 className="text-xs font-bold text-gray-500 uppercase mb-2">Change Password</h3>
      <div className="space-y-2">
        <div><label className="block text-[10px] font-bold text-gray-400 mb-0.5 uppercase">Current Password</label>
          <input type="password" value={oldPass} onChange={(e) => setOldPass(e.target.value)} placeholder="Current password" className={ic} /></div>
        <div><label className="block text-[10px] font-bold text-gray-400 mb-0.5 uppercase">New Password</label>
          <input type="password" value={newPass} onChange={(e) => setNewPass(e.target.value)} placeholder="Min 6 characters" className={ic} /></div>
        <div><label className="block text-[10px] font-bold text-gray-400 mb-0.5 uppercase">Confirm Password</label>
          <input type="password" value={confirmPass} onChange={(e) => setConfirmPass(e.target.value)} placeholder="Re-enter new password" className={ic}
            onKeyDown={(e) => { if (e.key === "Enter") handleChangePassword(); }} /></div>
        {passMsg && <p className={`text-xs font-semibold ${passMsg === "Password changed!" ? "text-green-600" : "text-red-500"}`}>{passMsg}</p>}
        <button onClick={handleChangePassword} disabled={passLoading}
          className="w-full h-9 bg-red-500 text-white rounded-lg text-sm font-bold hover:bg-red-600 transition disabled:opacity-50">
          {passLoading ? "Changing..." : "Change Password"}
        </button>
      </div>
    </div>
  );
}

// STAFF MANAGEMENT — admin/owner can see all, add, edit, delete staff
function StaffManagementSection() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({ username: "", password: "", role: "cashier" });
  const [msg, setMsg] = useState("");

  useEffect(() => {
    authAPI.me().then((u) => setCurrentUser(u)).catch(() => {});
    authAPI.getUsers().then((u) => { setUsers(Array.isArray(u) ? u : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const isAdmin = currentUser && ["owner", "admin", "manager"].includes(currentUser.role);

  const refresh = async () => {
    const u = await authAPI.getUsers();
    setUsers(Array.isArray(u) ? u : []);
  };

  const handleSave = async () => {
    setMsg("");
    if (!form.username) { setMsg("Username required"); return; }
    try {
      if (editId) {
        const data = { username: form.username, role: form.role };
        if (form.password && form.password.length >= 6) data.password = form.password;
        await authAPI.updateUser(editId, data);
        setMsg("Updated!");
      } else {
        if (!form.password || form.password.length < 6) { setMsg("Password min 6 chars"); return; }
        await authAPI.createUser(form);
        setMsg("Created!");
      }
      setShowAdd(false); setEditId(null); setForm({ username: "", password: "", role: "cashier" });
      await refresh();
      setTimeout(() => setMsg(""), 2000);
    } catch (err) { setMsg(err.message || "Failed"); }
  };

  const handleDelete = async (id, name) => {
    if (!confirm(`Delete user "${name}"?`)) return;
    try { await authAPI.deleteUser(id); await refresh(); setMsg("Deleted"); setTimeout(() => setMsg(""), 2000); }
    catch (err) { setMsg(err.message || "Failed"); }
  };

  const startEdit = (u) => {
    setEditId(u._id || u.id);
    setForm({ username: u.username, password: "", role: u.role });
    setShowAdd(true);
  };

  const roleColors = { owner: "bg-purple-100 text-purple-700", admin: "bg-purple-100 text-purple-700", manager: "bg-blue-100 text-blue-700", cashier: "bg-green-100 text-green-700", kitchen: "bg-orange-100 text-orange-700" };
  const ic = "w-full border border-gray-200 px-3 py-2 h-9 rounded-lg text-sm focus:ring-2 focus:ring-coffee outline-none";

  // Non-admin users only see their own info
  if (!isAdmin) {
    return (
      <div className="border-t border-gray-200 pt-5 mt-2">
        <h3 className="text-xs font-bold text-gray-500 uppercase mb-2">My Account</h3>
        {currentUser && (
          <div className="bg-gray-50 rounded-lg p-3 space-y-1">
            <p className="text-sm font-semibold text-gray-900">{currentUser.username}</p>
            <p className="text-xs text-gray-500">Role: <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${roleColors[currentUser.role] || "bg-gray-100"}`}>{currentUser.role}</span></p>
            {currentUser.lastLogin && <p className="text-[10px] text-gray-400">Last login: {new Date(currentUser.lastLogin).toLocaleString("en-IN")}</p>}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="border-t border-gray-200 pt-5 mt-2">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs font-bold text-gray-500 uppercase">Staff ({users.length})</h3>
        <button onClick={() => { setShowAdd(!showAdd); setEditId(null); setForm({ username: "", password: "", role: "cashier" }); }}
          className="text-[10px] font-bold text-coffee hover:underline">{showAdd ? "Cancel" : "+ Add Staff"}</button>
      </div>

      {msg && <p className={`text-xs font-semibold mb-2 ${msg.includes("!") ? "text-green-600" : "text-red-500"}`}>{msg}</p>}

      {/* Add/Edit Form */}
      {showAdd && (
        <div className="bg-gray-50 rounded-lg p-3 mb-3 space-y-2">
          <div><label className="block text-[10px] font-bold text-gray-400 mb-0.5 uppercase">Username</label>
            <input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} placeholder="staff_name" className={ic} /></div>
          <div><label className="block text-[10px] font-bold text-gray-400 mb-0.5 uppercase">{editId ? "New Password (leave blank to keep)" : "Password"}</label>
            <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder={editId ? "Leave blank to keep" : "Min 6 chars"} className={ic} /></div>
          <div><label className="block text-[10px] font-bold text-gray-400 mb-0.5 uppercase">Role</label>
            <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className={ic}>
              <option value="cashier">Cashier</option>
              <option value="kitchen">Kitchen</option>
              <option value="manager">Manager</option>
              <option value="owner">Owner</option>
            </select></div>
          <button onClick={handleSave} className="w-full h-9 bg-coffee text-white rounded-lg text-sm font-bold hover:bg-coffee-dark transition">
            {editId ? "Update Staff" : "Add Staff"}
          </button>
        </div>
      )}

      {/* Staff List */}
      {loading ? (
        <p className="text-xs text-gray-400 text-center py-4">Loading...</p>
      ) : (
        <div className="space-y-1.5">
          {users.map((u) => (
            <div key={u._id || u.id} className="flex items-center justify-between bg-white border border-gray-200 rounded-lg p-2.5">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-gray-900">{u.username}</span>
                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${roleColors[u.role] || "bg-gray-100 text-gray-600"}`}>{u.role}</span>
                  {currentUser && (u._id === currentUser.id || u.id === currentUser.id) && <span className="text-[9px] text-gray-400">(you)</span>}
                </div>
                {u.lastLogin && <p className="text-[10px] text-gray-400">Last: {new Date(u.lastLogin).toLocaleString("en-IN")}</p>}
              </div>
              <div className="flex gap-1 flex-shrink-0">
                <button onClick={() => startEdit(u)} className="px-2 py-1 text-[10px] font-bold text-coffee bg-coffee/10 rounded hover:bg-coffee/20">Edit</button>
                {currentUser && (u._id !== currentUser.id && u.id !== currentUser.id) && (
                  <button onClick={() => handleDelete(u._id || u.id, u.username)} className="px-2 py-1 text-[10px] font-bold text-red-500 bg-red-50 rounded hover:bg-red-100">Delete</button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ===== PRODUCTS MANAGEMENT POPUP — add/edit products with cost + profit =====
// ===== SALES SUMMARY POPUP =====
function SalesSummaryPopup({ onClose }) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [date, setDate] = useState("");

  const fetchData = async (d) => {
    setLoading(true);
    try {
      const raw = d ? await reportsAPI.salesSummaryByDate(d) : await reportsAPI.salesSummary();
      const items = raw?.data ?? raw;
      setData(Array.isArray(items) ? items : []);
    } catch {} finally { setLoading(false); }
  };

  useEffect(() => { fetchData(date); }, [date]);

  const { totalSales, totalCost, grossProfit: totalProfit } = calculateSalesSummary(data);

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-2 sm:p-4" onKeyDown={(e) => { if (e.key === "Escape") onClose(); }}>
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden shadow-xl flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-white border-b px-4 py-3 flex items-center justify-between z-10">
          <h2 className="text-lg font-bold">Sales Summary</h2>
          <div className="flex items-center gap-2">
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="border border-gray-200 px-2 py-1 h-8 rounded-lg text-xs" />
            <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg"><HiX className="w-5 h-5" /></button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          {/* Summary cards */}
          <div className="grid grid-cols-3 gap-2 mb-4">
            <div className="bg-green-50 border border-green-200 rounded-lg p-2.5 text-center"><p className="text-[10px] text-green-700">Sales</p><p className="text-sm font-bold text-green-900">₹{totalSales.toFixed(0)}</p></div>
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-2.5 text-center"><p className="text-[10px] text-yellow-700">Cost</p><p className="text-sm font-bold text-yellow-900">₹{totalCost.toFixed(0)}</p></div>
            <div className={`${totalProfit >= 0 ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"} border rounded-lg p-2.5 text-center`}><p className="text-[10px]">{totalProfit >= 0 ? "Profit" : "Loss"}</p><p className={`text-sm font-bold ${totalProfit >= 0 ? "text-green-700" : "text-red-700"}`}>₹{Math.abs(totalProfit).toFixed(0)}</p></div>
          </div>
          {loading ? <div className="text-center py-8"><div className="w-8 h-8 border-4 border-coffee border-t-transparent rounded-full animate-spin mx-auto" /></div> :
          data.length === 0 ? <p className="text-center text-gray-400 text-sm py-8">No data</p> :
          <div className="space-y-1.5">
            <div className="grid grid-cols-12 gap-2 px-3 py-1 text-[10px] font-bold text-gray-400 uppercase">
              <div className="col-span-4">Product</div><div className="col-span-1 text-right">Qty</div><div className="col-span-2 text-right">Sales</div><div className="col-span-2 text-right">Cost</div><div className="col-span-3 text-right">Profit</div>
            </div>
            {data.map((item, idx) => (
              <div key={idx} className="grid grid-cols-12 gap-2 px-3 py-2 bg-white border border-gray-100 rounded-lg items-center">
                <div className="col-span-4 font-semibold text-sm truncate">{item.name}</div>
                <div className="col-span-1 text-right text-xs text-gray-500">{item.soldQty}</div>
                <div className="col-span-2 text-right text-xs">₹{item.totalSales?.toFixed(0)}</div>
                <div className="col-span-2 text-right text-xs text-gray-500">₹{item.totalCost?.toFixed(0)}</div>
                <div className={`col-span-3 text-right text-xs font-bold ${item.profit >= 0 ? "text-green-600" : "text-red-600"}`}>
                  {item.profit >= 0 ? "+" : ""}₹{item.profit?.toFixed(0)} <span className="text-[9px] text-gray-400">({item.totalSales > 0 ? ((item.profit / item.totalSales) * 100).toFixed(0) : 0}%)</span>
                </div>
              </div>
            ))}
          </div>}
        </div>
      </div>
    </div>
  );
}

// ===== DAILY REPORT POPUP =====
function DailyReportPopup({ onClose }) {
  const [date, setDate] = useState(getISTToday());
  const [sales, setSales] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [payments, setPayments] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!date) return;
    setLoading(true);
    Promise.all([
      reportsAPI.salesSummaryByDate(date).catch(() => []),
      expensesAPI.getByDate(date).catch(() => []),
      ordersAPI.getAll({ status: "completed", date, limit: 500 }).catch(() => ({ orders: [] })),
    ]).then(([sRaw, eRaw, oRaw]) => {
      const s = sRaw?.data ?? sRaw;
      setSales(Array.isArray(s) ? s : []);
      const expData = eRaw?.expenses || (Array.isArray(eRaw) ? eRaw : []);
      setExpenses(expData);
      const o = oRaw?.data ?? oRaw;
      const orders = o?.orders || o;
      setPayments(aggregatePaymentMethods(Array.isArray(orders) ? orders : []));
    }).catch(() => {}).finally(() => setLoading(false));
  }, [date]);

  const { totalSales, totalCost, grossProfit } = calculateSalesSummary(sales);
  const { netExpenses: totalExpenses } = calculateExpenseSummary(expenses);
  const netProfit = grossProfit - totalExpenses;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-2 sm:p-4" onKeyDown={(e) => { if (e.key === "Escape") onClose(); }}>
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden shadow-xl flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-white border-b px-4 py-3 flex items-center justify-between z-10">
          <h2 className="text-lg font-bold">Daily Report</h2>
          <div className="flex items-center gap-2">
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="border border-gray-200 px-2 py-1 h-8 rounded-lg text-xs" />
            <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg"><HiX className="w-5 h-5" /></button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {loading ? <div className="text-center py-8"><div className="w-8 h-8 border-4 border-coffee border-t-transparent rounded-full animate-spin mx-auto" /></div> : <>
            {/* Summary */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div className="bg-green-50 border border-green-200 rounded-lg p-2 text-center"><p className="text-[10px] text-green-700">Sales</p><p className="text-sm font-bold">₹{totalSales.toFixed(0)}</p></div>
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-2 text-center"><p className="text-[10px] text-yellow-700">Cost</p><p className="text-sm font-bold">₹{totalCost.toFixed(0)}</p></div>
              <div className="bg-red-50 border border-red-200 rounded-lg p-2 text-center"><p className="text-[10px] text-red-700">Expenses</p><p className="text-sm font-bold">₹{totalExpenses.toFixed(0)}</p></div>
              <div className={`${netProfit >= 0 ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"} border rounded-lg p-2 text-center`}><p className="text-[10px]">Net Profit</p><p className={`text-sm font-bold ${netProfit >= 0 ? "text-green-700" : "text-red-700"}`}>₹{netProfit.toFixed(0)}</p></div>
            </div>
            {/* Payments */}
            {Object.keys(payments).length > 0 && (
              <div><h3 className="text-xs font-bold text-gray-500 uppercase mb-2">Payments</h3>
                <div className="grid grid-cols-3 gap-2">{Object.entries(payments).map(([m, a], i) => (
                  <div key={i} className="border border-gray-200 p-2 rounded-lg text-xs"><div className="font-medium">{m}</div><div className="font-bold text-coffee">₹{a.toFixed(0)}</div></div>
                ))}</div>
              </div>
            )}
            {/* Products sold */}
            {sales.length > 0 && (
              <div><h3 className="text-xs font-bold text-gray-500 uppercase mb-2">Products Sold</h3>
                <div className="space-y-1">{sales.map((item, idx) => {
                  const profit = (item.profit || 0);
                  return (
                    <div key={idx} className="flex justify-between items-center px-3 py-2 bg-white border border-gray-100 rounded-lg">
                      <div><span className="font-semibold text-sm">{item.name}</span> <span className="text-xs text-gray-400">×{item.soldQty}</span></div>
                      <div className="text-right"><span className="text-xs">₹{item.totalSales?.toFixed(0)}</span> <span className={`text-xs font-bold ml-2 ${profit >= 0 ? "text-green-600" : "text-red-600"}`}>{profit >= 0 ? "+" : ""}₹{profit.toFixed(0)}</span></div>
                    </div>
                  );
                })}</div>
              </div>
            )}
            {/* Expenses */}
            {expenses.length > 0 && (
              <div><h3 className="text-xs font-bold text-gray-500 uppercase mb-2">Expenses</h3>
                <div className="space-y-1">{expenses.map((e, i) => (
                  <div key={i} className="flex justify-between items-center px-3 py-2 bg-red-50 border border-red-100 rounded-lg">
                    <div><span className="font-semibold text-sm">{e.category}</span> <span className="text-xs text-gray-400">{e.method}</span></div>
                    <span className="font-bold text-sm text-red-600">₹{Number(e.amount).toFixed(0)}</span>
                  </div>
                ))}</div>
              </div>
            )}
          </>}
        </div>
      </div>
    </div>
  );
}

// ===== DAILY EXPENSE POPUP =====
function DailyExpensePopup({ onClose }) {
  const [date, setDate] = useState(getISTToday());
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ category: "", amount: "", notes: "", type: "out", method: "Cash" });
  const [editId, setEditId] = useState(null);
  const [msg, setMsg] = useState("");

  const fetchExpenses = async () => {
    setLoading(true);
    try {
      const data = await expensesAPI.getByDate(date);
      const items = data?.expenses || (Array.isArray(data) ? data : []);
      setExpenses(items.map((e) => ({ ...e, id: e._id || e.id })));
    } catch {} finally { setLoading(false); }
  };

  useEffect(() => { fetchExpenses(); }, [date]);

  const { totalIn, totalOut } = calculateExpenseSummary(expenses);

  const handleSubmit = async () => {
    if (!form.category || !form.amount) { setMsg("Category & amount required"); return; }
    setMsg("");
    const payload = { ...form, amount: Number(form.amount), date, createdAt: new Date().toISOString() };
    try {
      const result = editId
        ? await expensesAPI.update(editId, payload)
        : await expensesAPI.create(payload);
      if (result.success !== false) { setForm({ category: "", amount: "", notes: "", type: "out", method: "Cash" }); setEditId(null); fetchExpenses(); setMsg(editId ? "Updated!" : "Added!"); setTimeout(() => setMsg(""), 2000); }
      else setMsg(result.error || "Failed");
    } catch (err) { setMsg(err.message || "Error"); }
  };

  const handleDelete = async (id) => {
    if (!confirm("Delete?")) return;
    try { await expensesAPI.delete(id); fetchExpenses(); } catch {}
  };

  const ic = "w-full border border-gray-200 px-3 py-2 h-9 rounded-lg text-sm focus:ring-2 focus:ring-coffee outline-none";

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-2 sm:p-4" onKeyDown={(e) => { if (e.key === "Escape") onClose(); }}>
      <div className="bg-white rounded-2xl w-full max-w-xl max-h-[85vh] overflow-hidden shadow-xl flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-white border-b px-4 py-3 flex items-center justify-between z-10">
          <h2 className="text-lg font-bold">Daily Expenses</h2>
          <div className="flex items-center gap-2">
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="border border-gray-200 px-2 py-1 h-8 rounded-lg text-xs" />
            <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg"><HiX className="w-5 h-5" /></button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {msg && <p className={`text-xs font-bold text-center ${msg.includes("!") ? "text-green-600" : "text-red-500"}`}>{msg}</p>}
          {/* Form */}
          <div className="grid grid-cols-2 gap-2">
            <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className={ic} required>
              <option value="">Category</option>
              <option value="Milk">Milk</option><option value="Curd">Curd</option><option value="Grocery & Vegetables">Grocery</option><option value="Essential Items">Essentials</option>
              <option value="Samosa">Samosa</option><option value="Puffs">Puffs</option><option value="Water">Water</option><option value="Wastage">Wastage</option><option value="Other">Other</option>
              <option value="Salary">Salary</option><option value="Rent">Rent</option><option value="EB">EB</option><option value="Gas">Gas</option>
            </select>
            <input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="₹ Amount" className={ic} />
            <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className={ic}><option value="out">Out</option><option value="in">In</option></select>
            <select value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value })} className={ic}><option>Cash</option><option>UPI</option><option>Card</option><option>Bank</option></select>
          </div>
          <input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Notes" className={ic} />
          <button onClick={handleSubmit} className={`w-full h-9 ${editId ? "bg-accent" : "bg-coffee"} text-white rounded-lg text-sm font-bold hover:opacity-90`}>{editId ? "Update" : "Add Expense"}</button>

          {/* Summary */}
          <div className="grid grid-cols-3 gap-2 text-xs font-bold">
            <div className="bg-green-50 text-green-700 text-center p-2 rounded-lg">In: ₹{totalIn.toFixed(0)}</div>
            <div className="bg-red-50 text-red-700 text-center p-2 rounded-lg">Out: ₹{totalOut.toFixed(0)}</div>
            <div className="bg-gray-100 text-gray-800 text-center p-2 rounded-lg">Bal: ₹{(totalIn - totalOut).toFixed(0)}</div>
          </div>

          {/* List */}
          {loading ? <p className="text-center text-gray-400 text-xs py-4">Loading...</p> :
          expenses.length === 0 ? <p className="text-center text-gray-400 text-xs py-4">No expenses</p> :
          <div className="space-y-1">{expenses.map((e) => (
            <div key={e.id} className={`flex justify-between items-center px-3 py-2 rounded-lg border ${e.type === "in" ? "bg-green-50 border-green-100" : "bg-red-50 border-red-100"}`}>
              <div><span className="font-semibold text-sm">{e.category}</span> <span className="text-[10px] text-gray-400">{e.method}</span>{e.notes && <span className="text-[10px] text-gray-400 ml-1">· {e.notes}</span>}</div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm">₹{Number(e.amount).toFixed(0)}</span>
                <button onClick={() => { setEditId(e.id); setForm({ category: e.category, amount: e.amount, notes: e.notes || "", type: e.type || "out", method: e.method || "Cash" }); }} className="text-[9px] text-coffee font-bold">Edit</button>
                <button onClick={() => handleDelete(e.id)} className="text-[9px] text-red-500 font-bold">Del</button>
              </div>
            </div>
          ))}</div>}
        </div>
      </div>
    </div>
  );
}

function ProductsPopup({ onClose, onProductsChanged }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({ name: "", price: "", purchaseRate: "", mrp: "", type: "", description: "", imageUrl: "", isAvailable: true });
  const [msg, setMsg] = useState("");
  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState("");

  const cats = {1:"Tea",2:"Coffee",3:"Dairy Products",4:"Snacks",5:"Evening Special",6:"Fresh Juice",7:"Cool Drinks",8:"Ice Cream",9:"Karupatti Ice Cream",10:"Karupatti Snacks",11:"Other Snacks",12:"Biscuits & Cakes",13:"Parcel"};

  const fetchItems = async () => {
    try {
      const data = await productsAPI.getAll();
      setItems(Array.isArray(data) ? data.map((i) => ({ ...i, id: i._id || i.id })) : []);
    } catch {} finally { setLoading(false); }
  };

  useEffect(() => { fetchItems(); }, []);

  const resetForm = () => { setForm({ name: "", price: "", purchaseRate: "", mrp: "", type: "", description: "", imageUrl: "", isAvailable: true }); setEditId(null); setShowForm(false); };

  const handleSubmit = async () => {
    if (!form.name || !form.price || !form.type) { setMsg("Name, price, category required"); return; }
    setMsg("");
    try {
      const body = { ...form, price: Number(form.price), purchaseRate: Number(form.purchaseRate || 0), mrp: Number(form.mrp || 0), type: Number(form.type), isAvailable: form.isAvailable };
      if (editId) { await productsAPI.update(editId, body); } else { await productsAPI.create(body); }
      setMsg(editId ? "Updated!" : "Added!"); resetForm(); fetchItems(); if (onProductsChanged) onProductsChanged(); setTimeout(() => setMsg(""), 2000);
    } catch (err) { setMsg(err.message || "Error saving"); }
  };

  const handleDelete = async (id, name) => {
    if (!confirm(`Delete "${name}"?`)) return;
    try { await productsAPI.delete(id); fetchItems(); if (onProductsChanged) onProductsChanged(); setMsg("Deleted"); setTimeout(() => setMsg(""), 2000); }
    catch { setMsg("Delete failed"); }
  };

  const startEdit = (p) => {
    setEditId(p.id); setForm({ name: p.name, price: p.price, purchaseRate: p.purchaseRate || 0, mrp: p.mrp || 0, type: p.type, description: p.description || "", imageUrl: p.imageUrl || "", isAvailable: p.isAvailable !== false });
    setShowForm(true);
  };

  const filtered = items.filter((i) => {
    if (filterCat && i.type !== Number(filterCat)) return false;
    if (search && !i.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const ic = "w-full border border-gray-200 px-3 py-2 h-9 rounded-lg text-sm focus:ring-2 focus:ring-coffee outline-none";

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-2 sm:p-4" onKeyDown={(e) => { if (e.key === "Escape") onClose(); }}>
      <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[85vh] overflow-hidden shadow-xl flex flex-col" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between z-10">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-bold">Products ({items.length})</h2>
            <button onClick={() => { setShowForm(!showForm); if (showForm) resetForm(); }}
              className={`text-xs font-bold px-3 py-1.5 rounded-lg ${showForm ? "bg-gray-200 text-gray-700" : "bg-coffee text-white"}`}>
              {showForm ? "Cancel" : "+ Add Product"}
            </button>
          </div>
          <div className="flex items-center gap-2">
            {msg && <span className={`text-xs font-bold ${msg.includes("!") ? "text-green-600" : "text-red-500"}`}>{msg}</span>}
            <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg"><HiX className="w-5 h-5" /></button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {/* Add/Edit Form */}
          {showForm && (
            <div className="bg-gray-50 rounded-xl p-4 mb-4 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div><label className="block text-[10px] font-bold text-gray-400 mb-0.5 uppercase">Product Name *</label>
                  <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Filter Coffee" className={ic} /></div>
                <div><label className="block text-[10px] font-bold text-gray-400 mb-0.5 uppercase">Category *</label>
                  <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className={ic}>
                    <option value="">Select</option>
                    {Object.entries(cats).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select></div>
                <div><label className="block text-[10px] font-bold text-gray-400 mb-0.5 uppercase">Selling Price (₹) *</label>
                  <input type="number" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} placeholder="50" className={ic} /></div>
                <div><label className="block text-[10px] font-bold text-gray-400 mb-0.5 uppercase">Purchase/Cost Price (₹)</label>
                  <input type="number" value={form.purchaseRate} onChange={(e) => setForm({ ...form, purchaseRate: e.target.value })} placeholder="20" className={ic} /></div>
                <div><label className="block text-[10px] font-bold text-gray-400 mb-0.5 uppercase">MRP (₹)</label>
                  <input type="number" value={form.mrp} onChange={(e) => setForm({ ...form, mrp: e.target.value })} placeholder="60" className={ic} /></div>
                <div><label className="block text-[10px] font-bold text-gray-400 mb-0.5 uppercase">Description</label>
                  <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Short description" className={ic} /></div>
                <div className="sm:col-span-2"><label className="block text-[10px] font-bold text-gray-400 mb-0.5 uppercase">Image URL</label>
                  <div className="flex gap-2 items-center">
                    <input value={form.imageUrl} onChange={(e) => setForm({ ...form, imageUrl: e.target.value })} placeholder="https://..." className={`${ic} flex-1`} />
                    {form.imageUrl && <img src={form.imageUrl} alt="" className="w-9 h-9 rounded-lg object-cover border border-gray-200 flex-shrink-0" onError={(e) => { e.target.style.display = "none"; }} />}
                  </div></div>
                <div className="flex items-center gap-2 sm:col-span-2">
                  <label className="text-[10px] font-bold text-gray-400 uppercase">Available</label>
                  <button type="button" onClick={() => setForm({ ...form, isAvailable: !form.isAvailable })}
                    className={`w-10 h-5 rounded-full transition relative ${form.isAvailable ? "bg-green-500" : "bg-gray-300"}`}>
                    <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition ${form.isAvailable ? "left-5" : "left-0.5"}`} />
                  </button>
                  <span className={`text-xs font-semibold ${form.isAvailable ? "text-green-600" : "text-red-500"}`}>{form.isAvailable ? "Active" : "Hidden"}</span>
                </div>
              </div>
              {/* Profit preview */}
              {form.price && form.purchaseRate && (
                <div className={`p-2 rounded-lg text-xs font-bold text-center ${Number(form.price) - Number(form.purchaseRate) >= 0 ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
                  Profit per item: ₹{(Number(form.price) - Number(form.purchaseRate)).toFixed(2)} ({((Number(form.price) - Number(form.purchaseRate)) / Number(form.price) * 100).toFixed(1)}% margin)
                </div>
              )}
              <button onClick={handleSubmit} className="w-full h-9 bg-coffee text-white rounded-lg text-sm font-bold hover:bg-coffee-dark transition">
                {editId ? "Update Product" : "Add Product"}
              </button>
            </div>
          )}

          {/* Search + Filter */}
          <div className="flex gap-2 mb-3">
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search products..." className="flex-1 border border-gray-200 px-3 py-2 h-9 rounded-lg text-sm" />
            <select value={filterCat} onChange={(e) => setFilterCat(e.target.value)} className="border border-gray-200 px-2 py-2 h-9 rounded-lg text-xs">
              <option value="">All Categories</option>
              {Object.entries(cats).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>

          {/* Product List */}
          {loading ? (
            <div className="text-center py-8"><div className="w-8 h-8 border-4 border-coffee border-t-transparent rounded-full animate-spin mx-auto" /></div>
          ) : filtered.length === 0 ? (
            <p className="text-center text-gray-400 text-sm py-8">No products found</p>
          ) : (
            <div className="space-y-1.5">
              {/* Header */}
              <div className="hidden sm:grid grid-cols-12 gap-2 px-3 py-1.5 text-[10px] font-bold text-gray-400 uppercase">
                <div className="col-span-4">Product</div>
                <div className="col-span-2">Category</div>
                <div className="col-span-1 text-right">Cost</div>
                <div className="col-span-1 text-right">Sell</div>
                <div className="col-span-2 text-right">Profit</div>
                <div className="col-span-2 text-right">Actions</div>
              </div>
              {filtered.map((p) => {
                const profit = (p.price || 0) - (p.purchaseRate || 0);
                const margin = p.price > 0 ? (profit / p.price * 100).toFixed(0) : 0;
                return (
                  <div key={p.id} className="grid grid-cols-12 gap-2 items-center px-3 py-2 bg-white border border-gray-100 rounded-lg hover:border-gray-300 transition">
                    <div className="col-span-12 sm:col-span-4 min-w-0 flex items-center gap-1.5">
                      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${p.isAvailable !== false ? "bg-green-500" : "bg-red-400"}`} />
                      <p className={`font-semibold text-sm truncate ${p.isAvailable !== false ? "text-gray-900" : "text-gray-400 line-through"}`}>{p.name}</p>
                    </div>
                    <div className="col-span-4 sm:col-span-2">
                      <span className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">{cats[p.type] || "Other"}</span>
                    </div>
                    <div className="col-span-2 sm:col-span-1 text-right text-xs text-gray-500">₹{p.purchaseRate || 0}</div>
                    <div className="col-span-2 sm:col-span-1 text-right text-xs font-bold text-gray-900">₹{p.price}</div>
                    <div className="col-span-2 sm:col-span-2 text-right">
                      <span className={`text-xs font-bold ${profit >= 0 ? "text-green-600" : "text-red-600"}`}>
                        {profit >= 0 ? "+" : ""}₹{profit} <span className="text-[9px] text-gray-400">({margin}%)</span>
                      </span>
                    </div>
                    <div className="col-span-2 sm:col-span-2 flex gap-1 justify-end">
                      <button onClick={() => startEdit(p)} className="px-2 py-1 text-[10px] font-bold text-coffee bg-coffee/10 rounded hover:bg-coffee/20">Edit</button>
                      <button onClick={() => handleDelete(p.id, p.name)} className="px-2 py-1 text-[10px] font-bold text-red-500 bg-red-50 rounded hover:bg-red-100">Del</button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
