"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { HiChevronLeft, HiPlus, HiChevronDown, HiX } from "react-icons/hi";
import { stockAPI, purchasesAPI, productsAPI } from "@/app/lib/api";
import { getISTToday } from "@/app/lib/dateUtils";

export default function InventoryPage() {
  const router = useRouter();
  const [isVerified, setIsVerified] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Stock Overview
  const [products, setProducts] = useState([]);
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [stockFilter, setStockFilter] = useState("all");
  const [searchStock, setSearchStock] = useState("");
  const [adjustingId, setAdjustingId] = useState(null);
  const [adjustForm, setAdjustForm] = useState({ qty: 0, type: "received", reason: "" });

  // New Purchase
  const [purchaseForm, setPurchaseForm] = useState({
    supplier: "",
    phone: "",
    invoiceNumber: "",
    date: getISTToday(),
    items: [],
  });
  const [searchProduct, setSearchProduct] = useState("");
  const [suggestions, setSuggestions] = useState([]);

  // Purchase History
  const [purchases, setPurchases] = useState([]);
  const [expandedPurchase, setExpandedPurchase] = useState(null);

  // Stock Log
  const [stockLog, setStockLog] = useState([]);
  const [logTypeFilter, setLogTypeFilter] = useState("all");

  // Auth check
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      router.replace("/");
      return;
    }
    setIsVerified(true);
  }, [router]);

  // Load data based on active tab
  useEffect(() => {
    if (!isVerified) return;

    switch (activeTab) {
      case "overview":
        fetchStockOverview();
        break;
      case "history":
        fetchPurchaseHistory();
        break;
      case "log":
        fetchStockLog();
        break;
      default:
        break;
    }
  }, [isVerified, activeTab]);

  // Filter products
  useEffect(() => {
    let filtered = products;

    if (stockFilter !== "all") {
      filtered = filtered.filter((p) => {
        if (stockFilter === "tracked") return p.trackStock;
        if (stockFilter === "low") return p.stock > 0 && p.stock <= p.minStock;
        if (stockFilter === "out") return p.trackStock && p.stock === 0;
        return true;
      });
    }

    if (searchStock.trim()) {
      filtered = filtered.filter((p) =>
        (p.name || "").toLowerCase().includes(searchStock.toLowerCase())
      );
    }

    setFilteredProducts(filtered);
  }, [products, stockFilter, searchStock]);

  // Update suggestions for product search in purchase
  useEffect(() => {
    if (searchProduct.trim() && products.length > 0) {
      const sugg = products
        .filter((p) => (p.name || "").toLowerCase().includes(searchProduct.toLowerCase()))
        .slice(0, 5);
      setSuggestions(sugg);
    } else {
      setSuggestions([]);
    }
  }, [searchProduct, products]);

  const fetchStockOverview = async () => {
    setLoading(true);
    setError("");
    try {
      const prods = await productsAPI.getAll({ available: true });
      const formatted = Array.isArray(prods)
        ? prods.map((p) => ({
            id: p._id || p.id,
            name: p.name,
            stock: p.currentStock || p.stock || 0,
            minStock: p.lowStockThreshold || p.minStock || 5,
            trackStock: p.trackStock || false,
            unit: p.unit || "pcs",
            price: p.price || 0,
            purchaseRate: p.purchaseRate || 0,
            type: p.type,
          }))
        : [];
      setProducts(formatted);
    } catch (err) {
      setError(err.message || "Failed to load stock");
    } finally {
      setLoading(false);
    }
  };

  const fetchPurchaseHistory = async () => {
    setLoading(true);
    setError("");
    try {
      const hist = await purchasesAPI.getAll({ limit: 100 });
      setPurchases(Array.isArray(hist) ? hist : []);
    } catch (err) {
      setError(err.message || "Failed to load purchases");
    } finally {
      setLoading(false);
    }
  };

  const fetchStockLog = async () => {
    setLoading(true);
    setError("");
    try {
      const log = await stockAPI.getLog({ limit: 200 });
      setStockLog(Array.isArray(log) ? log : []);
    } catch (err) {
      setError(err.message || "Failed to load stock log");
    } finally {
      setLoading(false);
    }
  };

  const handleAdjustStock = async (productId) => {
    if (!adjustForm.qty || adjustForm.qty === 0) {
      alert("Please enter a quantity");
      return;
    }

    setLoading(true);
    setError("");
    try {
      await stockAPI.adjust({
        productId,
        type: adjustForm.type,
        quantity: parseInt(adjustForm.qty),
        reason: adjustForm.reason || "",
      });

      setAdjustingId(null);
      setAdjustForm({ qty: 0, type: "received", reason: "" });
      await fetchStockOverview();
      await fetchStockLog();
    } catch (err) {
      setError(err.message || "Failed to adjust stock");
    } finally {
      setLoading(false);
    }
  };

  const handleAddPurchaseItem = (product) => {
    const existing = purchaseForm.items.find((i) => i.productId === product.id);
    if (existing) {
      setPurchaseForm({
        ...purchaseForm,
        items: purchaseForm.items.map((i) =>
          i.productId === product.id ? { ...i, qty: i.qty + 1 } : i
        ),
      });
    } else {
      setPurchaseForm({
        ...purchaseForm,
        items: [
          ...purchaseForm.items,
          {
            productId: product.id,
            product: product.name,
            qty: 1,
            costPrice: product.purchaseRate || 0,
          },
        ],
      });
    }
    setSearchProduct("");
    setSuggestions([]);
  };

  const handleRemovePurchaseItem = (productId) => {
    setPurchaseForm({
      ...purchaseForm,
      items: purchaseForm.items.filter((i) => i.productId !== productId),
    });
  };

  const handleSavePurchase = async () => {
    if (!purchaseForm.supplier.trim()) {
      alert("Please enter supplier name");
      return;
    }
    if (purchaseForm.items.length === 0) {
      alert("Please add at least one item");
      return;
    }

    setLoading(true);
    setError("");
    try {
      const payload = {
        supplier: purchaseForm.supplier,
        phone: purchaseForm.phone,
        invoiceNumber: purchaseForm.invoiceNumber,
        date: purchaseForm.date,
        items: purchaseForm.items.map((i) => ({
          productId: i.productId,
          quantity: i.qty,
          costPrice: i.costPrice,
        })),
      };

      await purchasesAPI.create(payload);

      setPurchaseForm({
        supplier: "",
        phone: "",
        invoiceNumber: "",
        date: getISTToday(),
        items: [],
      });

      alert("Purchase saved successfully");
      setActiveTab("history");
      await fetchPurchaseHistory();
    } catch (err) {
      setError(err.message || "Failed to save purchase");
    } finally {
      setLoading(false);
    }
  };

  const getStockStatus = (stock, minStock) => {
    if (stock === 0) return { label: "Out", color: "bg-red-100 text-red-700" };
    if (stock <= minStock) return { label: "Low", color: "bg-orange-100 text-orange-700" };
    return { label: "In Stock", color: "bg-green-100 text-green-700" };
  };

  if (!isVerified) {
    return (
      <div className="flex items-center justify-center min-h-[100dvh] bg-white">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-coffee border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-coffee-light font-body">Verifying access...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-gray-50">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-coffee-dark text-cream shadow-md">
        <div className="flex items-center justify-between px-3 sm:px-5 py-3 h-auto min-h-[52px]">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.back()}
              className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
              aria-label="Back"
            >
              <HiChevronLeft className="h-5 w-5 text-cream" />
            </button>
            <h1 className="text-lg sm:text-xl font-bold text-cream font-display">Inventory</h1>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="border-t border-white/10 overflow-x-auto bg-white">
          <nav className="flex gap-1 px-3 sm:px-5 py-2 no-scrollbar">
            {["overview", "purchase", "history", "log"].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`whitespace-nowrap px-3 py-2 text-xs sm:text-sm font-medium rounded-lg transition-all ${
                  activeTab === tab
                    ? "bg-accent text-coffee-dark shadow-sm"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {tab === "overview"
                  ? "Stock"
                  : tab === "purchase"
                  ? "Purchase"
                  : tab === "history"
                  ? "History"
                  : "Log"}
              </button>
            ))}
          </nav>
        </div>
      </header>

      {/* Content */}
      <main className="px-3 sm:px-5 py-4 max-w-6xl mx-auto">
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-red-700 text-sm mb-4">
            {error}
          </div>
        )}

        {activeTab === "overview" && (
          <StockOverview
            products={filteredProducts}
            loading={loading}
            stockFilter={stockFilter}
            setStockFilter={setStockFilter}
            searchStock={searchStock}
            setSearchStock={setSearchStock}
            adjustingId={adjustingId}
            setAdjustingId={setAdjustingId}
            adjustForm={adjustForm}
            setAdjustForm={setAdjustForm}
            onAdjust={handleAdjustStock}
            getStockStatus={getStockStatus}
          />
        )}

        {activeTab === "purchase" && (
          <NewPurchase
            form={purchaseForm}
            setForm={setPurchaseForm}
            searchProduct={searchProduct}
            setSearchProduct={setSearchProduct}
            suggestions={suggestions}
            onSelectProduct={handleAddPurchaseItem}
            onRemoveItem={handleRemovePurchaseItem}
            onSave={handleSavePurchase}
            loading={loading}
          />
        )}

        {activeTab === "history" && (
          <PurchaseHistory
            purchases={purchases}
            loading={loading}
            expandedPurchase={expandedPurchase}
            setExpandedPurchase={setExpandedPurchase}
          />
        )}

        {activeTab === "log" && (
          <StockLog
            log={stockLog}
            loading={loading}
            logTypeFilter={logTypeFilter}
            setLogTypeFilter={setLogTypeFilter}
          />
        )}
      </main>
    </div>
  );
}

// ===== STOCK OVERVIEW =====
function StockOverview({
  products,
  loading,
  stockFilter,
  setStockFilter,
  searchStock,
  setSearchStock,
  adjustingId,
  setAdjustingId,
  adjustForm,
  setAdjustForm,
  onAdjust,
  getStockStatus,
}) {
  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4 flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        <div className="flex gap-2 flex-wrap">
          {["all", "low", "out"].map((filter) => (
            <button
              key={filter}
              onClick={() => setStockFilter(filter)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
                stockFilter === filter
                  ? "bg-accent text-coffee-dark"
                  : "bg-gray-200 text-gray-700 hover:bg-gray-300"
              }`}
            >
              {filter === "all" ? "All" : filter === "low" ? "Low Stock" : "Out of Stock"}
            </button>
          ))}
        </div>
        <input
          type="text"
          placeholder="Search products..."
          value={searchStock}
          onChange={(e) => setSearchStock(e.target.value)}
          className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-accent focus:outline-none"
        />
      </div>

      {/* Products Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="w-8 h-8 border-4 border-coffee border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-coffee-light text-sm">Loading inventory...</p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {products.map((prod) => {
            const status = getStockStatus(prod.stock, prod.minStock);
            const isAdjusting = adjustingId === prod.id;

            return (
              <div key={prod.id} className="bg-white rounded-lg shadow p-4">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h3 className="font-semibold text-coffee-dark">{prod.name}</h3>
                    <p className="text-xs text-gray-500 mt-0.5">Min: {prod.minStock} units</p>
                  </div>
                  <div className={`px-2.5 py-1 rounded-full text-xs font-medium ${status.color}`}>
                    {status.label}
                  </div>
                </div>

                <div className="mb-3 p-3 bg-gray-50 rounded-lg">
                  <div className="flex justify-between items-end">
                    <div>
                      <p className="text-xs text-gray-600 mb-1">Current Stock</p>
                      <p className="text-2xl font-bold text-coffee-dark">{prod.stock} <span className="text-xs font-normal text-gray-400">{prod.unit}</span></p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-gray-500">Value: ₹{(prod.stock * prod.purchaseRate).toFixed(0)}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 mt-2 pt-2 border-t border-gray-200">
                    <div><p className="text-[10px] text-gray-400">Cost</p><p className="text-xs font-bold">₹{prod.purchaseRate}</p></div>
                    <div><p className="text-[10px] text-gray-400">Sell</p><p className="text-xs font-bold">₹{prod.price}</p></div>
                    <div><p className="text-[10px] text-gray-400">Profit</p><p className={`text-xs font-bold ${prod.price - prod.purchaseRate >= 0 ? "text-green-600" : "text-red-600"}`}>{prod.price - prod.purchaseRate >= 0 ? "+" : ""}₹{(prod.price - prod.purchaseRate).toFixed(0)}</p></div>
                  </div>
                </div>

                {isAdjusting ? (
                  <div className="space-y-2 pt-2 border-t">
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="number"
                        min="0"
                        value={adjustForm.qty}
                        onChange={(e) => setAdjustForm({ ...adjustForm, qty: e.target.value })}
                        placeholder="Qty"
                        className="px-2 py-1.5 border border-gray-200 rounded text-sm focus:ring-2 focus:ring-accent focus:outline-none"
                      />
                      <select
                        value={adjustForm.type}
                        onChange={(e) => setAdjustForm({ ...adjustForm, type: e.target.value })}
                        className="px-2 py-1.5 border border-gray-200 rounded text-sm focus:ring-2 focus:ring-accent focus:outline-none"
                      >
                        <option value="received">Received</option>
                        <option value="wastage">Wastage</option>
                        <option value="adjustment">Adjustment</option>
                      </select>
                    </div>
                    <input
                      type="text"
                      value={adjustForm.reason}
                      onChange={(e) => setAdjustForm({ ...adjustForm, reason: e.target.value })}
                      placeholder="Reason (optional)"
                      className="w-full px-2 py-1.5 border border-gray-200 rounded text-sm focus:ring-2 focus:ring-accent focus:outline-none"
                    />
                    <div className="flex gap-2 pt-2">
                      <button
                        onClick={() => onAdjust(prod.id)}
                        className="flex-1 px-2 py-1.5 bg-green-600 text-white text-sm font-medium rounded hover:bg-green-700 transition-colors"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => {
                          setAdjustingId(null);
                          setAdjustForm({ qty: 0, type: "received", reason: "" });
                        }}
                        className="flex-1 px-2 py-1.5 bg-gray-300 text-gray-700 text-sm font-medium rounded hover:bg-gray-400 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => {
                      setAdjustingId(prod.id);
                      setAdjustForm({ qty: 0, type: "received", reason: "" });
                    }}
                    className="w-full px-3 py-1.5 bg-coffee text-cream text-sm font-medium rounded hover:bg-coffee-dark transition-colors"
                  >
                    Adjust Stock
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {!loading && products.length === 0 && (
        <div className="text-center py-12 text-coffee-light">
          <p className="text-sm">No products found</p>
        </div>
      )}
    </div>
  );
}

// ===== NEW PURCHASE =====
function NewPurchase({
  form,
  setForm,
  searchProduct,
  setSearchProduct,
  suggestions,
  onSelectProduct,
  onRemoveItem,
  onSave,
  loading,
}) {
  const grandTotal = form.items.reduce((sum, i) => sum + i.qty * i.costPrice, 0);

  return (
    <div className="bg-white rounded-lg shadow p-4 sm:p-6 max-w-2xl mx-auto">
      <h2 className="text-lg font-bold text-coffee-dark mb-4">New Purchase</h2>

      <div className="space-y-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Supplier Name</label>
          <input
            type="text"
            value={form.supplier}
            onChange={(e) => setForm({ ...form, supplier: e.target.value })}
            placeholder="Enter supplier name"
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-accent focus:outline-none"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
            <input
              type="tel"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              placeholder="Phone number"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-accent focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Invoice #</label>
            <input
              type="text"
              value={form.invoiceNumber}
              onChange={(e) => setForm({ ...form, invoiceNumber: e.target.value })}
              placeholder="Invoice number"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-accent focus:outline-none"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
          <input
            type="date"
            value={form.date}
            onChange={(e) => setForm({ ...form, date: e.target.value })}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-accent focus:outline-none"
          />
        </div>

        {/* Product Search */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Add Items</label>
          <div className="relative">
            <input
              type="text"
              value={searchProduct}
              onChange={(e) => setSearchProduct(e.target.value)}
              placeholder="Search products..."
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-accent focus:outline-none"
            />
            {suggestions.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-10">
                {suggestions.map((prod) => (
                  <button
                    key={prod.id}
                    onClick={() => onSelectProduct(prod)}
                    className="w-full text-left px-3 py-2 hover:bg-gray-50 text-sm border-b last:border-b-0"
                  >
                    {prod.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Items List */}
        {form.items.length > 0 && (
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-left px-3 py-2 font-semibold text-gray-700">Product</th>
                    <th className="text-center px-3 py-2 font-semibold text-gray-700">Qty</th>
                    <th className="text-right px-3 py-2 font-semibold text-gray-700">Cost Price</th>
                    <th className="text-right px-3 py-2 font-semibold text-gray-700">Total</th>
                    <th className="text-center px-3 py-2 font-semibold text-gray-700">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {form.items.map((item, idx) => (
                    <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="px-3 py-2 text-gray-700">{item.product}</td>
                      <td className="px-3 py-2 text-center">
                        <input
                          type="number"
                          min="1"
                          value={item.qty}
                          onChange={(e) => {
                            const newItems = [...form.items];
                            newItems[idx].qty = parseInt(e.target.value) || 1;
                            setForm({ ...form, items: newItems });
                          }}
                          className="w-12 px-1 py-1 border border-gray-200 rounded text-center text-sm"
                        />
                      </td>
                      <td className="px-3 py-2 text-right">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={item.costPrice}
                          onChange={(e) => {
                            const newItems = [...form.items];
                            newItems[idx].costPrice = parseFloat(e.target.value) || 0;
                            setForm({ ...form, items: newItems });
                          }}
                          className="w-20 px-1 py-1 border border-gray-200 rounded text-right text-sm"
                        />
                      </td>
                      <td className="px-3 py-2 text-right font-semibold text-coffee-dark">
                        ₹{(item.qty * item.costPrice).toFixed(2)}
                      </td>
                      <td className="px-3 py-2 text-center">
                        <button
                          onClick={() => onRemoveItem(item.productId)}
                          className="text-red-600 hover:text-red-800 transition-colors"
                        >
                          <HiX className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="bg-gray-50 px-3 py-3 border-t border-gray-200 flex justify-between items-center">
              <span className="font-semibold text-gray-700">Grand Total</span>
              <span className="text-lg font-bold text-coffee-dark">₹{grandTotal.toFixed(2)}</span>
            </div>
          </div>
        )}
      </div>

      <button
        onClick={onSave}
        disabled={loading || form.items.length === 0 || !form.supplier.trim()}
        className="w-full px-4 py-2.5 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {loading ? "Saving..." : "Save Purchase"}
      </button>
    </div>
  );
}

// ===== PURCHASE HISTORY =====
function PurchaseHistory({ purchases, loading, expandedPurchase, setExpandedPurchase }) {
  return (
    <div className="bg-white rounded-lg shadow">
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="w-8 h-8 border-4 border-coffee border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-coffee-light text-sm">Loading purchases...</p>
          </div>
        </div>
      ) : purchases.length === 0 ? (
        <div className="text-center py-12 text-coffee-light">
          <p className="text-sm">No purchases found</p>
        </div>
      ) : (
        <div className="divide-y divide-gray-200">
          {purchases.map((purchase) => (
            <div key={purchase._id || purchase.id} className="p-4">
              <button
                onClick={() =>
                  setExpandedPurchase(expandedPurchase === purchase._id ? null : purchase._id)
                }
                className="w-full text-left flex items-center justify-between hover:bg-gray-50 p-2 -m-2 rounded transition-colors"
              >
                <div>
                  <p className="font-semibold text-coffee-dark">{purchase.supplier}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    {purchase.invoiceNumber} • {new Date(purchase.date || purchase.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className="font-bold text-coffee-dark">₹{(purchase.total || 0).toFixed(2)}</p>
                    <p className="text-xs text-gray-500">{purchase.items?.length || 0} items</p>
                  </div>
                  <HiChevronDown
                    className={`w-5 h-5 text-gray-400 transition-transform ${
                      expandedPurchase === purchase._id ? "rotate-180" : ""
                    }`}
                  />
                </div>
              </button>

              {expandedPurchase === purchase._id && purchase.items && (
                <div className="mt-3 pt-3 border-t border-gray-100">
                  <div className="space-y-2">
                    {purchase.items.map((item, idx) => (
                      <div key={idx} className="flex justify-between text-sm">
                        <span className="text-gray-700">{item.product || item.name}</span>
                        <span className="text-gray-500">
                          {item.quantity} × ₹{(item.costPrice || 0).toFixed(2)} = ₹
                          {(item.quantity * (item.costPrice || 0)).toFixed(2)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ===== STOCK LOG =====
function StockLog({ log, loading, logTypeFilter, setLogTypeFilter }) {
  const filteredLog =
    logTypeFilter === "all"
      ? log
      : log.filter((entry) => entry.type === logTypeFilter);

  return (
    <div className="space-y-4">
      {/* Filter */}
      <div className="bg-white rounded-lg shadow p-4 flex gap-2 flex-wrap">
        {["all", "received", "wastage", "adjustment"].map((type) => (
          <button
            key={type}
            onClick={() => setLogTypeFilter(type)}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
              logTypeFilter === type
                ? "bg-accent text-coffee-dark"
                : "bg-gray-200 text-gray-700 hover:bg-gray-300"
            }`}
          >
            {type.charAt(0).toUpperCase() + type.slice(1)}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="w-8 h-8 border-4 border-coffee border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              <p className="text-coffee-light text-sm">Loading log...</p>
            </div>
          </div>
        ) : filteredLog.length === 0 ? (
          <div className="text-center py-12 text-coffee-light">
            <p className="text-sm">No entries found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-4 py-2 font-semibold text-gray-700">Date</th>
                  <th className="text-left px-4 py-2 font-semibold text-gray-700">Product</th>
                  <th className="text-center px-4 py-2 font-semibold text-gray-700">Type</th>
                  <th className="text-center px-4 py-2 font-semibold text-gray-700">Qty</th>
                  <th className="text-center px-4 py-2 font-semibold text-gray-700">Prev</th>
                  <th className="text-center px-4 py-2 font-semibold text-gray-700">New</th>
                  <th className="text-left px-4 py-2 font-semibold text-gray-700">Reason</th>
                </tr>
              </thead>
              <tbody>
                {filteredLog.map((entry, idx) => (
                  <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-2 text-gray-700">
                      {new Date(entry.date || entry.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-2 text-coffee-dark font-medium">{entry.product || entry.productName}</td>
                    <td className="px-4 py-2 text-center">
                      <span className="px-2 py-1 rounded text-xs font-medium bg-accent/30 text-coffee-dark">
                        {entry.type}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-center text-gray-700">{entry.quantity}</td>
                    <td className="px-4 py-2 text-center text-gray-600">{entry.previousStock || 0}</td>
                    <td className="px-4 py-2 text-center font-semibold text-coffee-dark">{entry.newStock || 0}</td>
                    <td className="px-4 py-2 text-gray-500">{entry.reason || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
