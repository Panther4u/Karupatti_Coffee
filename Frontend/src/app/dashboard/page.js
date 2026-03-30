"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { HiShoppingCart, HiCurrencyRupee, HiTrendingUp, HiTrendingDown, HiReceiptRefund, HiDocumentReport, HiArrowLeft, HiRefresh, HiCash } from "react-icons/hi";
import { authAPI, reportsAPI, reportsExtAPI, ordersAPI, expensesAPI, cashbookAPI, fundsAPI } from "@/app/lib/api";
import { getISTToday } from "@/app/lib/dateUtils";
import { calculateSalesSummary, calculateExpenseSummary, aggregatePaymentMethods } from "@/app/lib/calculations";
import { offlineAuthCheck } from "@/app/lib/authUtils";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

const COLORS = ["#6F4E37", "#D4A574", "#A67B5B", "#4A3423", "#2D6A4F", "#F4A261"];

function ChartTooltip({ active, payload, label, prefix = "₹" }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-lg px-3 py-2 shadow-lg text-xs">
      <p className="font-bold text-gray-700 mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color }}><span className="font-semibold">{p.name}: </span>{prefix}{Number(p.value).toLocaleString("en-IN")}</p>
      ))}
    </div>
  );
}

export default function Dashboard() {
  const router = useRouter();
  const [ok, setOk] = useState(false);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ orders: 0, revenue: 0, expenses: 0, cost: 0, profit: 0, cashInHand: 0, fundsSaved: 0 });
  const [recent, setRecent] = useState([]);
  const [payments, setPayments] = useState({});
  const [hourlyData, setHourlyData] = useState([]);
  const [topProducts, setTopProducts] = useState([]);

  useEffect(() => {
    offlineAuthCheck(authAPI, router).then((user) => { if (user) setOk(true); });
  }, [router]);

  const fetchAll = () => {
    if (!ok) return;
    setLoading(true);
    const today = getISTToday();
    Promise.all([
      reportsAPI.salesSummaryByDate(today).catch(() => []),
      ordersAPI.getAll({ limit: 10 }).catch(() => ({ orders: [] })),
      expensesAPI.getByDate(today).catch(() => []),
      ordersAPI.getToday().catch(() => ({ totalOrders: 0, orders: [] })),
      cashbookAPI.getToday().catch(() => null),
      fundsAPI.summary().catch(() => null),
      reportsExtAPI.hourly(today).catch(() => ({ hourly: [] })),
    ]).then(([sales, ordData, exps, todaySummary, cashbook, fundSummary, hourlyResult]) => {
      const s = Array.isArray(sales) ? sales : [];
      const expData = exps?.expenses || (Array.isArray(exps) ? exps : []);
      const { totalSales: ts, totalCost: tc } = calculateSalesSummary(s);
      const { netExpenses: te } = calculateExpenseSummary(expData);
      const todayOrders = todaySummary?.orders || [];
      const orderCount = todaySummary?.totalOrders || (Array.isArray(todayOrders) ? todayOrders.length : 0);
      const cashInHand = cashbook?.calculatedClosing ?? 0;
      const fundsSaved = fundSummary?.totalSaved ?? 0;
      setStats({ orders: orderCount, revenue: ts, cost: tc, expenses: te, profit: ts - tc - te, cashInHand, fundsSaved });
      const pm = aggregatePaymentMethods(todayOrders);
      setPayments(pm);
      const orders = ordData.orders || ordData;
      setRecent(Array.isArray(orders) ? orders.slice(0, 10) : []);
      // Top products from sales summary
      setTopProducts(s.sort((a, b) => (b.soldQty || 0) - (a.soldQty || 0)).slice(0, 8).map(p => ({
        name: (p.name || "").slice(0, 12), qty: p.soldQty || 0, revenue: p.totalSales || 0,
      })));
      // Hourly data
      const hd = hourlyResult?.hourly || [];
      setHourlyData(hd.map(h => ({
        hour: `${h.hour > 12 ? h.hour - 12 : h.hour || 12}${h.hour >= 12 ? "PM" : "AM"}`,
        revenue: h.totalRevenue || 0, orders: h.totalOrders || 0,
      })));
      setLoading(false);
    }).catch(() => setLoading(false));
  };

  useEffect(() => { fetchAll(); }, [ok]);

  if (!ok || loading) return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <div className="w-10 h-10 border-4 border-coffee border-t-transparent rounded-full animate-spin" />
    </div>
  );

  const paymentChartData = Object.entries(payments).map(([name, value]) => ({ name, value }));
  const paymentTotal = paymentChartData.reduce((s, p) => s + p.value, 0);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="sticky top-0 z-30 bg-coffee-dark text-cream shadow-md px-3 sm:px-5 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button onClick={() => router.push("/pages/order")} className="w-9 h-9 flex items-center justify-center rounded-lg bg-white/10 hover:bg-white/20"><HiArrowLeft className="h-5 w-5 text-cream" /></button>
          <h1 className="text-base sm:text-lg font-bold text-cream font-display">Dashboard</h1>
        </div>
        <button onClick={fetchAll} className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/10 hover:bg-white/20"><HiRefresh className="w-4 h-4 text-cream" /></button>
      </header>

      <div className="px-3 sm:px-5 py-4 space-y-4 max-w-4xl mx-auto">
        {/* Stat Cards */}
        <div className="grid grid-cols-2 gap-2 sm:gap-3">
          <div className="bg-coffee text-cream rounded-xl p-3"><p className="text-[10px] opacity-70">Orders</p><p className="text-lg font-bold font-mono">{stats.orders}</p></div>
          <div className="bg-accent text-coffee-dark rounded-xl p-3"><p className="text-[10px] opacity-70">Revenue</p><p className="text-lg font-bold font-mono">₹{stats.revenue.toLocaleString("en-IN")}</p></div>
          <div className="bg-red-500 text-white rounded-xl p-3"><p className="text-[10px] opacity-70">Expenses</p><p className="text-lg font-bold font-mono">₹{stats.expenses.toLocaleString("en-IN")}</p></div>
          <div className={`${stats.profit >= 0 ? "bg-green-600" : "bg-red-600"} text-white rounded-xl p-3`}><p className="text-[10px] opacity-70">Net Profit</p><p className="text-lg font-bold font-mono">₹{stats.profit.toLocaleString("en-IN")}</p></div>
        </div>

        <button onClick={() => router.push("/cashbook")} className="w-full bg-coffee text-cream rounded-xl p-3 text-left hover:bg-coffee-dark transition flex items-center gap-3">
          <HiCash className="w-6 h-6 opacity-80" />
          <div>
            <p className="text-[10px] opacity-70">Cash in Hand</p>
            <p className="text-lg font-bold font-mono">₹{stats.cashInHand.toLocaleString("en-IN")}</p>
            {stats.fundsSaved > 0 && <p className="text-[10px] opacity-70 mt-0.5">Funds: ₹{stats.fundsSaved.toLocaleString("en-IN")} saved</p>}
          </div>
        </button>

        {/* Hourly Sales Chart */}
        {hourlyData.length > 0 && (
          <div className="bg-white rounded-xl border p-3 sm:p-4">
            <h3 className="text-xs font-bold text-gray-500 uppercase mb-3">Today&apos;s Sales by Hour</h3>
            <div className="h-[180px] sm:h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={hourlyData}>
                  <XAxis dataKey="hour" tick={{ fontSize: 9 }} />
                  <YAxis tick={{ fontSize: 9 }} tickFormatter={v => `₹${v}`} />
                  <Tooltip content={<ChartTooltip />} />
                  <Bar dataKey="revenue" name="Revenue" fill="#6F4E37" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Top Products Chart */}
        {topProducts.length > 0 && (
          <div className="bg-white rounded-xl border p-3 sm:p-4">
            <h3 className="text-xs font-bold text-gray-500 uppercase mb-3">Top Products</h3>
            <div className="h-[200px] sm:h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topProducts} layout="vertical" margin={{ left: 5 }}>
                  <XAxis type="number" tick={{ fontSize: 9 }} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 9 }} width={70} />
                  <Tooltip content={<ChartTooltip prefix="" />} />
                  <Bar dataKey="qty" name="Qty Sold" fill="#D4A574" radius={[0, 3, 3, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Payments Pie Chart */}
        {paymentChartData.length > 0 && (
          <div className="bg-white rounded-xl border p-3 sm:p-4">
            <h3 className="text-xs font-bold text-gray-500 uppercase mb-3">Payments</h3>
            <div className="flex flex-col sm:flex-row items-center gap-4">
              <div className="h-[160px] w-[160px] sm:h-[180px] sm:w-[180px] flex-shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={paymentChartData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius="35%" outerRadius="70%">
                      {paymentChartData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip content={<ChartTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex-1 w-full space-y-2">
                {paymentChartData.sort((a, b) => b.value - a.value).map((p, i) => {
                  const pct = paymentTotal > 0 ? (p.value / paymentTotal * 100).toFixed(0) : 0;
                  return (
                    <div key={p.name} className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: COLORS[i % COLORS.length] }} />
                      <span className="text-xs text-gray-600 flex-1">{p.name}</span>
                      <span className="text-xs font-bold text-gray-800">₹{p.value.toLocaleString("en-IN")}</span>
                      <span className="text-[10px] text-gray-400 w-8 text-right">{pct}%</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Recent Orders */}
        <div className="bg-white rounded-xl border p-3 sm:p-4">
          <div className="flex justify-between items-center mb-2"><h3 className="text-xs font-bold text-gray-500 uppercase">Recent Orders</h3><button onClick={() => router.push("/viewreceipts")} className="text-[10px] text-coffee font-bold">View All</button></div>
          {recent.length === 0 ? <p className="text-gray-400 text-sm text-center py-4">No orders yet</p> : (
            <div className="space-y-1.5">{recent.map((o, i) => (
              <div key={o._id||i} className="flex justify-between items-center py-1.5 border-b border-gray-50 last:border-0">
                <div className="flex-1 min-w-0"><span className="text-xs font-bold text-coffee font-mono">{o.billNo||o.orderNumber}</span><p className="text-[10px] text-gray-400 truncate">{o.order?.map(i=>i.name).join(", ")}</p></div>
                <div className="text-right ml-2"><p className="text-xs font-bold">₹{o.grandTotal?.toFixed(0)}</p><p className="text-[9px] text-gray-400">{o.paymentMethod}</p></div>
              </div>
            ))}</div>
          )}
        </div>

        {/* Quick Nav */}
        <div className="flex flex-wrap gap-2 pb-4">
          <button onClick={() => router.push("/pages/order")} className="flex items-center gap-2 px-4 py-2.5 bg-coffee text-cream rounded-xl font-semibold text-sm"><HiShoppingCart className="w-4 h-4" />New Order</button>
          <button onClick={() => router.push("/viewreceipts")} className="flex items-center gap-2 px-4 py-2.5 bg-accent text-coffee-dark rounded-xl font-semibold text-sm"><HiReceiptRefund className="w-4 h-4" />Receipts</button>
          <button onClick={() => router.push("/reports")} className="flex items-center gap-2 px-4 py-2.5 bg-green-600 text-white rounded-xl font-semibold text-sm"><HiDocumentReport className="w-4 h-4" />Reports</button>
        </div>
        <p className="text-[10px] text-gray-400 text-center pb-4">&copy; 2026 EndlessScript. All rights reserved.</p>
      </div>
    </div>
  );
}
