"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { HiChevronLeft, HiDownload, HiPrinter, HiTrendingUp, HiTrendingDown } from "react-icons/hi";
import { reportsExtAPI } from "@/app/lib/api";
import { getISTToday } from "@/app/lib/dateUtils";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, CartesianGrid } from "recharts";

const COLORS = ["#6F4E37", "#D4A574", "#A67B5B", "#4A3423", "#2D6A4F", "#F4A261", "#D62828", "#E9C46A"];

function CustomTooltip({ active, payload, label, prefix = "₹" }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-lg px-3 py-2 shadow-lg text-xs">
      <p className="font-bold text-gray-700 mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} className="text-gray-600">
          <span className="font-semibold" style={{ color: p.color }}>{p.name}: </span>
          {prefix}{Number(p.value).toLocaleString("en-IN")}
        </p>
      ))}
    </div>
  );
}

export default function ReportsPage() {
  const router = useRouter();
  const [isVerified, setIsVerified] = useState(false);
  const [activeTab, setActiveTab] = useState("hourly");
  const [dateRange, setDateRange] = useState({ startDate: getISTToday(), endDate: getISTToday() });
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [compareType, setCompareType] = useState("daily");

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) { router.replace("/"); return; }
    setIsVerified(true);
  }, [router]);

  useEffect(() => {
    if (!isVerified) return;
    fetchTabData();
  }, [isVerified, activeTab, dateRange, compareType]);

  const fetchTabData = async () => {
    setLoading(true); setError(""); setData(null);
    try {
      const { startDate, endDate } = dateRange;
      let result = null;
      switch (activeTab) {
        case "hourly": result = await reportsExtAPI.hourly(startDate); break;
        case "category": result = await reportsExtAPI.categoryWise(startDate, endDate); break;
        case "products": result = await reportsExtAPI.productPerformance(startDate, endDate, "qty", 20); break;
        case "payments": result = await reportsExtAPI.paymentBreakdown(startDate, endDate); break;
        case "expenses": result = await reportsExtAPI.expenseSummary(startDate, endDate); break;
        case "customers": result = await reportsExtAPI.customerStats(startDate, endDate); break;
        case "compare": result = await reportsExtAPI.comparative(compareType); break;
      }
      setData(result);
    } catch (err) {
      setError(err.message || "Failed to load report data");
    } finally { setLoading(false); }
  };

  const handleQuickDate = (type) => {
    const todayStr = getISTToday();
    if (type === "today") setDateRange({ startDate: todayStr, endDate: todayStr });
    else if (type === "week") {
      const d = new Date(); d.setDate(d.getDate() - 7);
      setDateRange({ startDate: d.toISOString().split("T")[0], endDate: todayStr });
    } else if (type === "month") {
      const d = new Date(); d.setDate(d.getDate() - 30);
      setDateRange({ startDate: d.toISOString().split("T")[0], endDate: todayStr });
    }
  };

  const handleExport = (format) => {
    if (!data) return;
    if (format === "csv") {
      const csv = convertToCSV(data);
      const blob = new Blob([csv], { type: "text/csv" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = `report-${activeTab}-${Date.now()}.csv`; a.click();
      window.URL.revokeObjectURL(url);
    } else window.print();
  };

  const convertToCSV = (obj) => {
    if (Array.isArray(obj) && obj.length > 0) {
      const h = Object.keys(obj[0]);
      return h.join(",") + "\n" + obj.map(r => h.map(k => typeof r[k] === "string" ? `"${r[k]}"` : r[k]).join(",")).join("\n");
    }
    return JSON.stringify(obj, null, 2);
  };

  if (!isVerified) return (
    <div className="flex items-center justify-center min-h-[100dvh] bg-white">
      <div className="w-10 h-10 border-4 border-coffee border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="min-h-[100dvh] bg-gray-50">
      <header className="sticky top-0 z-30 bg-coffee-dark text-cream shadow-md">
        <div className="flex items-center justify-between px-3 sm:px-5 py-3">
          <div className="flex items-center gap-3">
            <button onClick={() => router.back()} className="w-10 h-10 flex items-center justify-center rounded-lg bg-white/10 hover:bg-white/20">
              <HiChevronLeft className="h-5 w-5" />
            </button>
            <h1 className="text-lg sm:text-xl font-bold font-display">Reports</h1>
          </div>
          <div className="flex gap-2">
            <button onClick={() => handleExport("csv")} disabled={!data || loading} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white/10 text-xs sm:text-sm hover:bg-white/20 disabled:opacity-50">
              <HiDownload className="w-4 h-4" /><span className="hidden sm:inline">CSV</span>
            </button>
            <button onClick={() => handleExport("print")} disabled={!data || loading} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white/10 text-xs sm:text-sm hover:bg-white/20 disabled:opacity-50">
              <HiPrinter className="w-4 h-4" /><span className="hidden sm:inline">Print</span>
            </button>
          </div>
        </div>
        <div className="px-3 sm:px-5 py-3 border-t border-gray-200 bg-gray-50">
          <div className="flex flex-wrap gap-2 mb-2">
            {["today", "week", "month"].map(t => (
              <button key={t} onClick={() => handleQuickDate(t)} className="px-3 py-1.5 text-xs font-medium rounded-lg bg-accent text-coffee-dark hover:opacity-90">
                {t === "today" ? "Today" : t === "week" ? "This Week" : "This Month"}
              </button>
            ))}
          </div>
          <div className="flex gap-2 flex-col sm:flex-row">
            <input type="date" value={dateRange.startDate} onChange={(e) => setDateRange({ ...dateRange, startDate: e.target.value })} className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-accent outline-none" />
            <input type="date" value={dateRange.endDate} onChange={(e) => setDateRange({ ...dateRange, endDate: e.target.value })} className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-accent outline-none" />
          </div>
        </div>
        <div className="border-t border-gray-200 overflow-x-auto bg-white">
          <nav className="flex gap-1 px-3 sm:px-5 py-2">
            {["hourly", "category", "products", "payments", "expenses", "customers", "compare"].map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                className={`whitespace-nowrap px-3 py-2 text-xs sm:text-sm font-medium rounded-lg transition ${activeTab === tab ? "bg-accent text-coffee-dark shadow-sm" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className="px-3 sm:px-5 py-4 max-w-5xl mx-auto">
        {loading && <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-coffee border-t-transparent rounded-full animate-spin" /></div>}
        {error && <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-red-700 text-sm mb-4">{error}</div>}
        {!loading && data && <ReportContent tab={activeTab} data={data} compareType={compareType} setCompareType={setCompareType} />}
        {!loading && !data && !error && <div className="text-center py-12 text-gray-400 text-sm">No data available</div>}
        <p className="text-[10px] text-gray-400 text-center py-4">&copy; 2026 EndlessScript. All rights reserved.</p>
      </main>
    </div>
  );
}

function ReportContent({ tab, data, compareType, setCompareType }) {
  switch (tab) {
    case "hourly": return <HourlyReport data={data} />;
    case "category": return <CategoryReport data={data} />;
    case "products": return <ProductsReport data={data} />;
    case "payments": return <PaymentsReport data={data} />;
    case "expenses": return <ExpensesReport data={data} />;
    case "customers": return <CustomersReport data={data} />;
    case "compare": return <CompareReport data={data} compareType={compareType} setCompareType={setCompareType} />;
    default: return null;
  }
}

// ===== HOURLY REPORT =====
function HourlyReport({ data }) {
  const hourlyData = (data?.hourly || (Array.isArray(data) ? data : [])).map(h => ({
    hour: `${h.hour > 12 ? h.hour - 12 : h.hour || 12}${h.hour >= 12 ? "PM" : "AM"}`,
    revenue: h.totalRevenue || h.total || 0,
    orders: h.totalOrders || 0,
    items: h.totalItems || 0,
  }));
  const totalRev = hourlyData.reduce((s, h) => s + h.revenue, 0);
  const totalOrd = hourlyData.reduce((s, h) => s + h.orders, 0);
  const peak = hourlyData.reduce((p, h) => h.revenue > (p?.revenue || 0) ? h : p, null);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-white rounded-lg p-3 text-center shadow-sm"><p className="text-[10px] text-gray-500">Revenue</p><p className="text-lg font-bold text-coffee">₹{totalRev.toLocaleString("en-IN")}</p></div>
        <div className="bg-white rounded-lg p-3 text-center shadow-sm"><p className="text-[10px] text-gray-500">Orders</p><p className="text-lg font-bold text-coffee-dark">{totalOrd}</p></div>
        <div className="bg-white rounded-lg p-3 text-center shadow-sm"><p className="text-[10px] text-gray-500">Peak Hour</p><p className="text-lg font-bold text-coffee-dark">{peak?.hour || "-"}</p></div>
      </div>
      <div className="bg-white rounded-lg shadow-sm p-3 sm:p-4">
        <h2 className="text-sm font-bold text-gray-800 mb-3">Hourly Sales</h2>
        <div className="h-[220px] sm:h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={hourlyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="hour" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `₹${v}`} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="revenue" name="Revenue" fill="#6F4E37" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

// ===== CATEGORY REPORT =====
function CategoryReport({ data }) {
  const categories = data?.categories || (Array.isArray(data) ? data : []);
  const chartData = categories.map(c => ({
    name: c.category || c.name || "Other",
    revenue: c.totalRevenue || c.sales || c.total || 0,
    qty: c.totalQty || 0,
  }));
  const total = chartData.reduce((s, c) => s + c.revenue, 0);

  return (
    <div className="space-y-4">
      {chartData.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm p-3 sm:p-4">
          <h2 className="text-sm font-bold text-gray-800 mb-3">Sales by Category</h2>
          <div className="h-[250px] sm:h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={chartData} dataKey="revenue" nameKey="name" cx="50%" cy="50%" innerRadius="35%" outerRadius="65%"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false} style={{ fontSize: 10 }}>
                  {chartData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
      <div className="bg-white rounded-lg shadow-sm p-3 sm:p-4">
        <div className="space-y-2">
          {chartData.map((cat, i) => {
            const pct = total > 0 ? (cat.revenue / total * 100).toFixed(1) : 0;
            return (
              <div key={i} className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: COLORS[i % COLORS.length] }} />
                <span className="text-xs sm:text-sm text-gray-700 flex-1 truncate">{cat.name}</span>
                <span className="text-xs text-gray-400">{pct}%</span>
                <span className="text-xs sm:text-sm font-bold text-gray-800 w-16 text-right">₹{cat.revenue.toLocaleString("en-IN")}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ===== PRODUCTS REPORT =====
function ProductsReport({ data }) {
  const products = data?.products || (Array.isArray(data) ? data : []);
  const chartData = products.slice(0, 10).map(p => ({
    name: (p.name || p.product || "").slice(0, 14),
    qty: p.totalQty || p.qty || p.quantity || 0,
    revenue: p.totalRevenue || p.revenue || p.total || 0,
  }));
  const bottom = products.slice(-10).reverse();

  return (
    <div className="space-y-4">
      {chartData.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm p-3 sm:p-4">
          <h2 className="text-sm font-bold text-gray-800 mb-3">Top 10 Products by Quantity</h2>
          <div className="h-[280px] sm:h-[350px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} layout="vertical" margin={{ left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis type="number" tick={{ fontSize: 10 }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={80} />
                <Tooltip content={<CustomTooltip prefix="" />} />
                <Bar dataKey="qty" name="Qty Sold" fill="#D4A574" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
      <div className="bg-white rounded-lg shadow-sm p-3 sm:p-4">
        <h2 className="text-sm font-bold text-gray-800 mb-3">Top Products</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-xs sm:text-sm">
            <thead><tr className="border-b border-gray-200">
              <th className="text-left px-2 py-2 text-gray-600">#</th>
              <th className="text-left px-2 py-2 text-gray-600">Product</th>
              <th className="text-right px-2 py-2 text-gray-600">Qty</th>
              <th className="text-right px-2 py-2 text-gray-600">Revenue</th>
            </tr></thead>
            <tbody>{products.slice(0, 10).map((p, i) => (
              <tr key={i} className="border-b border-gray-100">
                <td className="px-2 py-2 text-gray-500">{i + 1}</td>
                <td className="px-2 py-2 font-medium text-gray-800">{p.name || p.product}</td>
                <td className="px-2 py-2 text-right text-gray-600">{p.totalQty || p.qty || 0}</td>
                <td className="px-2 py-2 text-right font-semibold text-coffee">₹{(p.totalRevenue || p.revenue || 0).toLocaleString("en-IN")}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </div>
      {bottom.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm p-3 sm:p-4">
          <h2 className="text-sm font-bold text-gray-800 mb-3">Bottom 10 Products</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-xs sm:text-sm">
              <thead><tr className="border-b border-gray-200">
                <th className="text-left px-2 py-2 text-gray-600">#</th>
                <th className="text-left px-2 py-2 text-gray-600">Product</th>
                <th className="text-right px-2 py-2 text-gray-600">Qty</th>
                <th className="text-right px-2 py-2 text-gray-600">Revenue</th>
              </tr></thead>
              <tbody>{bottom.map((p, i) => (
                <tr key={i} className="border-b border-gray-100">
                  <td className="px-2 py-2 text-gray-500">{i + 1}</td>
                  <td className="px-2 py-2 font-medium text-gray-800">{p.name || p.product}</td>
                  <td className="px-2 py-2 text-right text-gray-600">{p.totalQty || p.qty || 0}</td>
                  <td className="px-2 py-2 text-right font-semibold text-coffee">₹{(p.totalRevenue || p.revenue || 0).toLocaleString("en-IN")}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ===== PAYMENTS REPORT =====
function PaymentsReport({ data }) {
  const breakdown = data?.breakdown || data?.methods || (Array.isArray(data) ? data : []);
  const chartData = breakdown.map(p => ({
    name: (p.paymentMethod || p.method || p.name || "Other").toUpperCase(),
    value: p.totalAmount || p.amount || p.total || 0,
    orders: p.totalOrders || 0,
  }));
  const total = chartData.reduce((s, p) => s + p.value, 0);

  return (
    <div className="space-y-4">
      {chartData.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm p-3 sm:p-4">
          <h2 className="text-sm font-bold text-gray-800 mb-3">Payment Methods</h2>
          <div className="h-[220px] sm:h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={chartData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius="30%" outerRadius="60%"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false} style={{ fontSize: 10 }}>
                  {chartData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
      <div className="bg-white rounded-lg shadow-sm p-3 sm:p-4">
        {chartData.map((p, i) => {
          const pct = total > 0 ? (p.value / total * 100).toFixed(1) : 0;
          return (
            <div key={i} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                <span className="text-sm font-medium text-gray-700">{p.name}</span>
              </div>
              <div className="text-right">
                <span className="text-sm font-bold text-gray-800">₹{p.value.toLocaleString("en-IN")}</span>
                <span className="text-xs text-gray-400 ml-2">{pct}%</span>
                <span className="text-xs text-gray-400 ml-2">({p.orders} orders)</span>
              </div>
            </div>
          );
        })}
        <div className="flex justify-between pt-3 mt-2 border-t border-gray-200 font-bold text-coffee-dark">
          <span>Total</span><span>₹{total.toLocaleString("en-IN")}</span>
        </div>
      </div>
    </div>
  );
}

// ===== EXPENSES REPORT =====
function ExpensesReport({ data }) {
  const summary = data?.summary || data?.expenses || (Array.isArray(data) ? data : []);
  const chartData = summary.map(e => ({
    name: (e.category || e.name || "Other").slice(0, 12),
    amount: e.totalAmount || e.amount || e.total || 0,
  }));
  const totalIn = data?.totalIn || 0;
  const totalOut = data?.totalOut || 0;
  const net = data?.net || (totalOut - totalIn);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-green-50 rounded-lg p-3 text-center"><p className="text-[10px] text-green-600">Income In</p><p className="text-lg font-bold text-green-700">₹{totalIn.toLocaleString("en-IN")}</p></div>
        <div className="bg-red-50 rounded-lg p-3 text-center"><p className="text-[10px] text-red-600">Expenses Out</p><p className="text-lg font-bold text-red-700">₹{totalOut.toLocaleString("en-IN")}</p></div>
        <div className="bg-gray-50 rounded-lg p-3 text-center"><p className="text-[10px] text-gray-600">Net</p><p className={`text-lg font-bold ${net >= 0 ? "text-red-700" : "text-green-700"}`}>₹{Math.abs(net).toLocaleString("en-IN")}</p></div>
      </div>
      {chartData.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm p-3 sm:p-4">
          <h2 className="text-sm font-bold text-gray-800 mb-3">Expenses by Category</h2>
          <div className="h-[220px] sm:h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} layout="vertical" margin={{ left: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={v => `₹${v}`} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={70} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="amount" name="Amount" fill="#D62828" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
      <div className="bg-white rounded-lg shadow-sm p-3 sm:p-4">
        {summary.map((e, i) => (
          <div key={i} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
            <span className="text-sm text-gray-700">{e.category || e.name}</span>
            <span className="text-sm font-bold text-red-600">₹{(e.totalAmount || e.amount || 0).toLocaleString("en-IN")}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ===== CUSTOMERS REPORT =====
function CustomersReport({ data }) {
  const totalCustomers = data?.totalCustomers || 0;
  const totalOrders = data?.totalOrders || 0;
  const totalSpent = data?.totalSpent || 0;
  const customers = data?.customers || [];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-white rounded-lg p-3 text-center shadow-sm"><p className="text-[10px] text-gray-500">Customers</p><p className="text-xl font-bold text-coffee-dark">{totalCustomers}</p></div>
        <div className="bg-white rounded-lg p-3 text-center shadow-sm"><p className="text-[10px] text-gray-500">Orders</p><p className="text-xl font-bold text-coffee-dark">{totalOrders}</p></div>
        <div className="bg-white rounded-lg p-3 text-center shadow-sm"><p className="text-[10px] text-gray-500">Total Spent</p><p className="text-xl font-bold text-coffee">₹{totalSpent.toLocaleString("en-IN")}</p></div>
      </div>
      {customers.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm p-3 sm:p-4">
          <h2 className="text-sm font-bold text-gray-800 mb-3">Top Customers</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-xs sm:text-sm">
              <thead><tr className="border-b border-gray-200">
                <th className="text-left px-2 py-2 text-gray-600">Name</th>
                <th className="text-left px-2 py-2 text-gray-600">Phone</th>
                <th className="text-right px-2 py-2 text-gray-600">Orders</th>
                <th className="text-right px-2 py-2 text-gray-600">Spent</th>
              </tr></thead>
              <tbody>{customers.slice(0, 20).map((c, i) => (
                <tr key={i} className="border-b border-gray-100">
                  <td className="px-2 py-2 font-medium text-gray-800">{c.name || "—"}</td>
                  <td className="px-2 py-2 text-gray-600">{c.phone || "—"}</td>
                  <td className="px-2 py-2 text-right text-gray-600">{c.totalOrders || 0}</td>
                  <td className="px-2 py-2 text-right font-semibold text-coffee">₹{(c.totalSpent || 0).toLocaleString("en-IN")}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </div>
      )}
      {customers.length === 0 && <div className="bg-white rounded-lg shadow-sm p-6 text-center text-gray-400 text-sm">No customer data for this period</div>}
    </div>
  );
}

// ===== COMPARE REPORT =====
function CompareReport({ data, compareType, setCompareType }) {
  const label = data?.label || "Comparison";
  const current = data?.current || {};
  const previous = data?.previous || {};
  const revChange = data?.revenueChangePercent;
  const ordChange = data?.ordersChangePercent;

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {["daily", "weekly", "monthly"].map(t => (
          <button key={t} onClick={() => setCompareType(t)}
            className={`px-3 py-2 text-xs sm:text-sm font-medium rounded-lg transition ${compareType === t ? "bg-coffee text-cream" : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"}`}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>
      <div className="bg-white rounded-lg shadow-sm p-4">
        <h2 className="text-sm font-bold text-gray-800 mb-4">{label}</h2>
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-coffee/5 rounded-lg p-3">
            <p className="text-[10px] text-gray-500 mb-1">Current Period</p>
            <p className="text-[10px] text-gray-400">{current.from} — {current.to}</p>
            <p className="text-lg font-bold text-coffee mt-1">₹{(current.totalRevenue || 0).toLocaleString("en-IN")}</p>
            <p className="text-xs text-gray-500">{current.totalOrders || 0} orders</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-[10px] text-gray-500 mb-1">Previous Period</p>
            <p className="text-[10px] text-gray-400">{previous.from} — {previous.to}</p>
            <p className="text-lg font-bold text-gray-700 mt-1">₹{(previous.totalRevenue || 0).toLocaleString("en-IN")}</p>
            <p className="text-xs text-gray-500">{previous.totalOrders || 0} orders</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 mt-3">
          <div className={`flex items-center justify-between p-3 rounded-lg ${revChange >= 0 ? "bg-green-50" : "bg-red-50"}`}>
            <div>
              <p className="text-[10px] text-gray-500">Revenue Change</p>
              <p className={`text-lg font-bold ${revChange >= 0 ? "text-green-700" : "text-red-700"}`}>
                {revChange !== null ? `${revChange > 0 ? "+" : ""}${revChange}%` : "N/A"}
              </p>
            </div>
            {revChange !== null && (revChange >= 0 ? <HiTrendingUp className="w-6 h-6 text-green-500" /> : <HiTrendingDown className="w-6 h-6 text-red-500" />)}
          </div>
          <div className={`flex items-center justify-between p-3 rounded-lg ${ordChange >= 0 ? "bg-green-50" : "bg-red-50"}`}>
            <div>
              <p className="text-[10px] text-gray-500">Orders Change</p>
              <p className={`text-lg font-bold ${ordChange >= 0 ? "text-green-700" : "text-red-700"}`}>
                {ordChange !== null ? `${ordChange > 0 ? "+" : ""}${ordChange}%` : "N/A"}
              </p>
            </div>
            {ordChange !== null && (ordChange >= 0 ? <HiTrendingUp className="w-6 h-6 text-green-500" /> : <HiTrendingDown className="w-6 h-6 text-red-500" />)}
          </div>
        </div>
      </div>
    </div>
  );
}
