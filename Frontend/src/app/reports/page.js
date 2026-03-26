"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { HiChevronLeft, HiDownload, HiPrinter } from "react-icons/hi";
import { reportsExtAPI } from "@/app/lib/api";

export default function ReportsPage() {
  const router = useRouter();
  const [isVerified, setIsVerified] = useState(false);
  const [activeTab, setActiveTab] = useState("hourly");
  const [dateRange, setDateRange] = useState({
    startDate: new Date().toISOString().split("T")[0],
    endDate: new Date().toISOString().split("T")[0],
  });
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  // Auth check
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      router.replace("/");
      return;
    }
    setIsVerified(true);
  }, [router]);

  // Fetch data based on active tab
  useEffect(() => {
    if (!isVerified) return;
    fetchTabData();
  }, [isVerified, activeTab, dateRange]);

  const fetchTabData = async () => {
    setLoading(true);
    setError("");
    setData(null);

    try {
      let result = null;
      const { startDate, endDate } = dateRange;

      switch (activeTab) {
        case "hourly":
          result = await reportsExtAPI.hourly(startDate);
          break;
        case "category":
          result = await reportsExtAPI.categoryWise(startDate, endDate);
          break;
        case "products":
          result = await reportsExtAPI.productPerformance(startDate, endDate, "qty", 10);
          break;
        case "payments":
          result = await reportsExtAPI.paymentBreakdown(startDate, endDate);
          break;
        case "expenses":
          result = await reportsExtAPI.expenseSummary(startDate, endDate);
          break;
        case "customers":
          result = await reportsExtAPI.customerStats(startDate, endDate);
          break;
        case "compare":
          result = await reportsExtAPI.comparative("daily");
          break;
        default:
          result = null;
      }

      setData(result);
    } catch (err) {
      setError(err.message || "Failed to load report data");
    } finally {
      setLoading(false);
    }
  };

  const handleQuickDate = (type) => {
    const now = new Date();
    const todayStr = now.toISOString().split("T")[0];
    let start, end;

    switch (type) {
      case "today":
        start = todayStr;
        end = todayStr;
        break;
      case "week": {
        const weekAgo = new Date(now);
        weekAgo.setDate(weekAgo.getDate() - 7);
        start = weekAgo.toISOString().split("T")[0];
        end = todayStr;
        break;
      }
      case "month": {
        const monthAgo = new Date(now);
        monthAgo.setDate(monthAgo.getDate() - 30);
        start = monthAgo.toISOString().split("T")[0];
        end = todayStr;
        break;
      }
      default:
        return;
    }

    setDateRange({ startDate: start, endDate: end });
  };

  const handleExport = (format) => {
    if (!data) return;

    if (format === "csv") {
      const csv = convertToCSV(data);
      downloadFile(csv, `report-${activeTab}-${Date.now()}.csv`, "text/csv");
    } else if (format === "print") {
      window.print();
    }
  };

  const convertToCSV = (obj) => {
    let csv = "";
    if (Array.isArray(obj)) {
      if (obj.length === 0) return "No data available";
      const headers = Object.keys(obj[0]);
      csv = headers.join(",") + "\n";
      obj.forEach((row) => {
        csv += headers.map((h) => {
          const val = row[h];
          if (typeof val === "string") {
            return `"${val.replace(/"/g, '""')}"`;
          }
          return val;
        }).join(",") + "\n";
      });
    } else {
      csv = JSON.stringify(obj, null, 2);
    }
    return csv;
  };

  const downloadFile = (content, filename, type) => {
    const blob = new Blob([content], { type });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    window.URL.revokeObjectURL(url);
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
      <header className="sticky top-0 z-30 bg-white shadow-sm border-b border-gray-100">
        <div className="flex items-center justify-between px-3 sm:px-5 py-3 h-auto min-h-[52px]">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.back()}
              className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors"
              aria-label="Back"
            >
              <HiChevronLeft className="h-5 w-5 text-coffee" />
            </button>
            <h1 className="text-lg sm:text-xl font-bold text-coffee-dark font-display">Reports</h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleExport("csv")}
              disabled={!data || loading}
              className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg bg-blue-100 text-blue-700 text-xs sm:text-sm font-medium hover:bg-blue-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <HiDownload className="w-4 h-4" />
              <span className="hidden sm:inline">CSV</span>
            </button>
            <button
              onClick={() => handleExport("print")}
              disabled={!data || loading}
              className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg bg-gray-200 text-gray-700 text-xs sm:text-sm font-medium hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <HiPrinter className="w-4 h-4" />
              <span className="hidden sm:inline">Print</span>
            </button>
          </div>
        </div>

        {/* Date Range Picker */}
        <div className="px-3 sm:px-5 py-3 border-t border-gray-100 bg-white">
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => handleQuickDate("today")}
                className="px-3 py-1.5 text-xs font-medium rounded-lg bg-accent text-coffee-dark hover:bg-opacity-90 transition-all"
              >
                Today
              </button>
              <button
                onClick={() => handleQuickDate("week")}
                className="px-3 py-1.5 text-xs font-medium rounded-lg bg-gray-200 text-gray-700 hover:bg-gray-300 transition-all"
              >
                This Week
              </button>
              <button
                onClick={() => handleQuickDate("month")}
                className="px-3 py-1.5 text-xs font-medium rounded-lg bg-gray-200 text-gray-700 hover:bg-gray-300 transition-all"
              >
                This Month
              </button>
            </div>

            {/* Custom Date Range */}
            <div className="flex gap-2 flex-col sm:flex-row">
              <input
                type="date"
                value={dateRange.startDate}
                onChange={(e) => setDateRange({ ...dateRange, startDate: e.target.value })}
                className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-accent focus:outline-none"
              />
              <input
                type="date"
                value={dateRange.endDate}
                onChange={(e) => setDateRange({ ...dateRange, endDate: e.target.value })}
                className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-accent focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="border-t border-gray-100 overflow-x-auto">
          <nav className="flex gap-1 px-3 sm:px-5 py-2 no-scrollbar">
            {["hourly", "category", "products", "payments", "expenses", "customers", "compare"].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`whitespace-nowrap px-3 py-2 text-xs sm:text-sm font-medium rounded-lg transition-all ${
                  activeTab === tab
                    ? "bg-accent text-coffee-dark shadow-sm"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </nav>
        </div>
      </header>

      {/* Content */}
      <main className="px-3 sm:px-5 py-4 max-w-6xl mx-auto">
        {loading && (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="w-8 h-8 border-4 border-coffee border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              <p className="text-coffee-light text-sm">Loading data...</p>
            </div>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-red-700 text-sm mb-4">
            {error}
          </div>
        )}

        {!loading && data && (
          <ReportContent tab={activeTab} data={data} dateRange={dateRange} />
        )}

        {!loading && !data && !error && (
          <div className="text-center py-12 text-coffee-light">
            <p className="text-sm">No data available for the selected period</p>
          </div>
        )}
      </main>
    </div>
  );
}

function ReportContent({ tab, data, dateRange }) {
  switch (tab) {
    case "hourly":
      return <HourlyReport data={data} />;
    case "category":
      return <CategoryReport data={data} />;
    case "products":
      return <ProductsReport data={data} />;
    case "payments":
      return <PaymentsReport data={data} />;
    case "expenses":
      return <ExpensesReport data={data} />;
    case "customers":
      return <CustomersReport data={data} />;
    case "compare":
      return <CompareReport data={data} />;
    default:
      return null;
  }
}

// ===== HOURLY REPORT =====
function HourlyReport({ data }) {
  const hourlyData = Array.isArray(data) ? data : data?.hourly || [];
  const maxValue = Math.max(...hourlyData.map((h) => h.total || 0), 1);

  return (
    <div className="bg-white rounded-lg shadow p-4 sm:p-6">
      <h2 className="text-lg font-bold text-coffee-dark mb-4">Hourly Sales</h2>
      <div className="space-y-2">
        {hourlyData.map((item, idx) => (
          <div key={idx} className="flex items-center gap-3">
            <div className="w-12 text-sm font-medium text-coffee-light">{item.hour || idx}:00</div>
            <div className="flex-1 h-8 bg-gray-100 rounded-lg overflow-hidden relative">
              <div
                className="h-full bg-gradient-to-r from-coffee-dark to-coffee rounded transition-all duration-300"
                style={{ width: `${((item.total || 0) / maxValue) * 100}%` }}
              />
            </div>
            <div className="w-16 text-right text-sm font-semibold text-coffee-dark">
              ₹{(item.total || 0).toFixed(0)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ===== CATEGORY REPORT =====
function CategoryReport({ data }) {
  const categoryData = Array.isArray(data) ? data : data?.categories || [];
  const totalSales = categoryData.reduce((sum, c) => sum + (c.sales || c.total || 0), 0);

  return (
    <div className="bg-white rounded-lg shadow p-4 sm:p-6">
      <h2 className="text-lg font-bold text-coffee-dark mb-4">Sales by Category</h2>
      <div className="space-y-3">
        {categoryData.map((cat, idx) => {
          const sales = cat.sales || cat.total || 0;
          const percentage = totalSales > 0 ? (sales / totalSales) * 100 : 0;
          return (
            <div key={idx}>
              <div className="flex justify-between items-center mb-1">
                <span className="text-sm font-medium text-gray-700">{cat.category || cat.name}</span>
                <span className="text-sm font-bold text-coffee-dark">₹{sales.toFixed(0)} ({percentage.toFixed(1)}%)</span>
              </div>
              <div className="h-6 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-accent to-yellow-400 transition-all duration-300"
                  style={{ width: `${percentage}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ===== PRODUCTS REPORT =====
function ProductsReport({ data }) {
  const productData = Array.isArray(data) ? data : data?.products || [];
  const top10 = productData.slice(0, 10);
  const bottom10 = productData.slice(-10).reverse();

  return (
    <div className="space-y-6">
      {/* Top 10 */}
      <div className="bg-white rounded-lg shadow p-4 sm:p-6">
        <h2 className="text-lg font-bold text-coffee-dark mb-4">Top 10 Products</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left px-3 py-2 font-semibold text-gray-700">#</th>
                <th className="text-left px-3 py-2 font-semibold text-gray-700">Product</th>
                <th className="text-right px-3 py-2 font-semibold text-gray-700">Qty</th>
                <th className="text-right px-3 py-2 font-semibold text-gray-700">Revenue</th>
              </tr>
            </thead>
            <tbody>
              {top10.map((prod, idx) => (
                <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-3 py-2 text-gray-700">{idx + 1}</td>
                  <td className="px-3 py-2 text-coffee-dark font-medium">{prod.product || prod.name}</td>
                  <td className="px-3 py-2 text-right text-gray-700">{prod.qty || prod.quantity || 0}</td>
                  <td className="px-3 py-2 text-right font-semibold text-coffee-dark">₹{(prod.revenue || prod.total || 0).toFixed(0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Bottom 10 */}
      {bottom10.length > 0 && (
        <div className="bg-white rounded-lg shadow p-4 sm:p-6">
          <h2 className="text-lg font-bold text-coffee-dark mb-4">Bottom 10 Products</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left px-3 py-2 font-semibold text-gray-700">#</th>
                  <th className="text-left px-3 py-2 font-semibold text-gray-700">Product</th>
                  <th className="text-right px-3 py-2 font-semibold text-gray-700">Qty</th>
                  <th className="text-right px-3 py-2 font-semibold text-gray-700">Revenue</th>
                </tr>
              </thead>
              <tbody>
                {bottom10.map((prod, idx) => (
                  <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-3 py-2 text-gray-700">{idx + 1}</td>
                    <td className="px-3 py-2 text-coffee-dark font-medium">{prod.product || prod.name}</td>
                    <td className="px-3 py-2 text-right text-gray-700">{prod.qty || prod.quantity || 0}</td>
                    <td className="px-3 py-2 text-right font-semibold text-coffee-dark">₹{(prod.revenue || prod.total || 0).toFixed(0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ===== PAYMENTS REPORT =====
function PaymentsReport({ data }) {
  const paymentData = Array.isArray(data) ? data : data?.methods || [];
  const totalAmount = paymentData.reduce((sum, p) => sum + (p.amount || p.total || 0), 0);

  return (
    <div className="bg-white rounded-lg shadow p-4 sm:p-6">
      <h2 className="text-lg font-bold text-coffee-dark mb-4">Payment Methods</h2>
      <div className="space-y-3">
        {paymentData.map((payment, idx) => {
          const amount = payment.amount || payment.total || 0;
          const percentage = totalAmount > 0 ? (amount / totalAmount) * 100 : 0;
          return (
            <div key={idx}>
              <div className="flex justify-between items-center mb-1">
                <span className="text-sm font-medium text-gray-700 capitalize">{payment.method || payment.name}</span>
                <span className="text-sm font-bold text-coffee-dark">₹{amount.toFixed(0)} ({percentage.toFixed(1)}%)</span>
              </div>
              <div className="h-6 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-green-500 to-emerald-500 transition-all duration-300"
                  style={{ width: `${percentage}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ===== EXPENSES REPORT =====
function ExpensesReport({ data }) {
  const expenseData = Array.isArray(data) ? data : data?.expenses || [];
  const totalExpenses = expenseData.reduce((sum, e) => sum + (e.amount || e.total || 0), 0);

  return (
    <div className="bg-white rounded-lg shadow p-4 sm:p-6">
      <h2 className="text-lg font-bold text-coffee-dark mb-4">Expenses by Category</h2>
      <div className="space-y-3 mb-4">
        {expenseData.map((exp, idx) => (
          <div key={idx} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
            <span className="text-sm font-medium text-gray-700">{exp.category || exp.name}</span>
            <span className="text-sm font-bold text-red-600">₹{(exp.amount || exp.total || 0).toFixed(0)}</span>
          </div>
        ))}
      </div>
      <div className="border-t pt-3">
        <div className="flex justify-between items-center font-bold text-coffee-dark">
          <span>Total Expenses</span>
          <span className="text-lg">₹{totalExpenses.toFixed(0)}</span>
        </div>
      </div>
    </div>
  );
}

// ===== CUSTOMERS REPORT =====
function CustomersReport({ data }) {
  const customerData = data || {};
  const walkIn = customerData.walkIn || 0;
  const returning = customerData.returning || 0;
  const total = walkIn + returning;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div className="bg-white rounded-lg shadow p-6 text-center">
        <p className="text-gray-600 text-sm font-medium mb-2">Walk-in Customers</p>
        <p className="text-3xl font-bold text-coffee-dark">{walkIn}</p>
        {total > 0 && <p className="text-xs text-gray-500 mt-2">{((walkIn / total) * 100).toFixed(1)}%</p>}
      </div>
      <div className="bg-white rounded-lg shadow p-6 text-center">
        <p className="text-gray-600 text-sm font-medium mb-2">Returning Customers</p>
        <p className="text-3xl font-bold text-coffee-dark">{returning}</p>
        {total > 0 && <p className="text-xs text-gray-500 mt-2">{((returning / total) * 100).toFixed(1)}%</p>}
      </div>
      <div className="bg-white rounded-lg shadow p-6 text-center">
        <p className="text-gray-600 text-sm font-medium mb-2">Total Customers</p>
        <p className="text-3xl font-bold text-coffee-dark">{total}</p>
      </div>
    </div>
  );
}

// ===== COMPARE REPORT =====
function CompareReport({ data }) {
  const compareData = Array.isArray(data) ? data : data?.comparison || [];

  return (
    <div className="bg-white rounded-lg shadow p-4 sm:p-6">
      <h2 className="text-lg font-bold text-coffee-dark mb-4">Period Comparison</h2>
      <div className="space-y-4">
        {compareData.map((item, idx) => {
          const changePercent = item.changePercent || 0;
          const isPositive = changePercent >= 0;
          return (
            <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div>
                <p className="text-sm font-medium text-gray-700">{item.period || item.label}</p>
                <p className="text-xs text-gray-500 mt-0.5">₹{(item.amount || 0).toFixed(0)}</p>
              </div>
              <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg ${isPositive ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                <span className="text-sm font-bold">{Math.abs(changePercent).toFixed(1)}%</span>
                <span className="text-lg">{isPositive ? "↑" : "↓"}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
