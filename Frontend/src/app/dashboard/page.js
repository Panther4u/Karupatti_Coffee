"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { HiShoppingCart, HiCurrencyRupee, HiTrendingUp, HiTrendingDown, HiReceiptRefund, HiDocumentReport, HiArrowLeft, HiRefresh, HiCash } from "react-icons/hi";
import { authAPI, reportsAPI, ordersAPI, expensesAPI, cashbookAPI } from "@/app/lib/api";
import { getISTToday } from "@/app/lib/dateUtils";
import { calculateSalesSummary, calculateExpenseSummary, aggregatePaymentMethods } from "@/app/lib/calculations";
import { clearAuth } from "@/app/lib/authUtils";

export default function Dashboard() {
  const router = useRouter();
  const [ok, setOk] = useState(false);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ orders: 0, revenue: 0, expenses: 0, cost: 0, profit: 0, cashInHand: 0 });
  const [recent, setRecent] = useState([]);
  const [payments, setPayments] = useState({});

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) { router.replace("/"); return; }
    authAPI.me().then(() => setOk(true)).catch(() => { clearAuth(); router.replace("/"); });
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
    ]).then(([sales, ordData, exps, todaySummary, cashbook]) => {
      const s = Array.isArray(sales) ? sales : [];
      const expData = exps?.expenses || (Array.isArray(exps) ? exps : []);
      const { totalSales: ts, totalCost: tc } = calculateSalesSummary(s);
      const { netExpenses: te } = calculateExpenseSummary(expData);
      const todayOrders = todaySummary?.orders || [];
      const orderCount = todaySummary?.totalOrders || (Array.isArray(todayOrders) ? todayOrders.length : 0);
      const cashInHand = cashbook?.calculatedClosing ?? 0;
      setStats({ orders: orderCount, revenue: ts, cost: tc, expenses: te, profit: ts - tc - te, cashInHand });
      const pm = aggregatePaymentMethods(todayOrders);
      setPayments(pm);
      const orders = ordData.orders || ordData;
      setRecent(Array.isArray(orders) ? orders.slice(0, 10) : []);
      setLoading(false);
    }).catch(() => setLoading(false));
  };

  useEffect(() => { fetchAll(); }, [ok]);

  if (!ok || loading) return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <div className="w-10 h-10 border-4 border-coffee border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="sticky top-0 z-30 bg-white shadow-sm border-b px-3 sm:px-5 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button onClick={() => router.push("/pages/order")} className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-gray-100"><HiArrowLeft className="h-5 w-5 text-coffee" /></button>
          <h1 className="text-base sm:text-lg font-bold text-coffee-dark font-display">Dashboard</h1>
        </div>
        <button onClick={fetchAll} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100"><HiRefresh className="w-4 h-4 text-gray-500" /></button>
      </header>

      <div className="px-3 sm:px-5 py-4 space-y-4 max-w-4xl mx-auto">
        <div className="grid grid-cols-2 gap-2 sm:gap-3">
          <div className="bg-coffee text-cream rounded-xl p-3"><p className="text-[10px] opacity-70">Orders</p><p className="text-lg font-bold font-mono">{stats.orders}</p></div>
          <div className="bg-accent text-coffee-dark rounded-xl p-3"><p className="text-[10px] opacity-70">Revenue</p><p className="text-lg font-bold font-mono">₹{stats.revenue.toLocaleString("en-IN")}</p></div>
          <div className="bg-red-500 text-white rounded-xl p-3"><p className="text-[10px] opacity-70">Expenses</p><p className="text-lg font-bold font-mono">₹{stats.expenses.toLocaleString("en-IN")}</p></div>
          <div className={`${stats.profit >= 0 ? "bg-green-600" : "bg-red-600"} text-white rounded-xl p-3`}><p className="text-[10px] opacity-70">Net Profit</p><p className="text-lg font-bold font-mono">₹{stats.profit.toLocaleString("en-IN")}</p></div>
        </div>
        <button onClick={() => router.push("/cashbook")} className="w-full bg-blue-600 text-white rounded-xl p-3 text-left hover:bg-blue-700 transition flex items-center gap-3">
          <HiCash className="w-6 h-6 opacity-80" />
          <div><p className="text-[10px] opacity-70">Cash in Hand</p><p className="text-lg font-bold font-mono">₹{stats.cashInHand.toLocaleString("en-IN")}</p></div>
        </button>

        {Object.keys(payments).length > 0 && (
          <div className="bg-white rounded-xl border p-3 sm:p-4">
            <h3 className="text-xs font-bold text-gray-500 uppercase mb-2">Payments</h3>
            <div className="space-y-2">{Object.entries(payments).sort((a,b) => b[1]-a[1]).map(([m, a]) => {
              const total = Object.values(payments).reduce((s,v) => s+v, 0);
              const pct = total > 0 ? (a/total*100).toFixed(0) : 0;
              return (<div key={m}><div className="flex justify-between text-sm mb-1"><span>{m}</span><span className="font-bold">₹{a.toLocaleString("en-IN")} ({pct}%)</span></div><div className="h-2 bg-gray-100 rounded-full"><div className="h-full bg-coffee rounded-full" style={{width:pct+"%"}} /></div></div>);
            })}</div>
          </div>
        )}

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

        <div className="flex flex-wrap gap-2 pb-4">
          <button onClick={() => router.push("/pages/order")} className="flex items-center gap-2 px-4 py-2.5 bg-coffee text-cream rounded-xl font-semibold text-sm"><HiShoppingCart className="w-4 h-4" />New Order</button>
          <button onClick={() => router.push("/viewreceipts")} className="flex items-center gap-2 px-4 py-2.5 bg-accent text-coffee-dark rounded-xl font-semibold text-sm"><HiReceiptRefund className="w-4 h-4" />Receipts</button>
          <button onClick={() => router.push("/kitchen")} className="flex items-center gap-2 px-4 py-2.5 bg-orange-500 text-white rounded-xl font-semibold text-sm"><HiDocumentReport className="w-4 h-4" />Kitchen</button>
        </div>
        <p className="text-[10px] text-gray-400 text-center pb-4">&copy; 2026 EndlessScript. All rights reserved.</p>
      </div>
    </div>
  );
}
