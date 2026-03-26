"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { HiArrowLeft, HiCash, HiTrendingUp, HiTrendingDown, HiLockClosed, HiLockOpen, HiRefresh, HiPlus, HiPencil, HiTrash, HiCheckCircle } from "react-icons/hi";
import { cashbookAPI, expensesAPI, authAPI, fundsAPI } from "@/app/lib/api";
import { getISTToday } from "@/app/lib/dateUtils";

export default function CashBookPage() {
  const router = useRouter();
  const [isAuth, setIsAuth] = useState(false);
  const [activeTab, setActiveTab] = useState("today");
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [selectedDate, setSelectedDate] = useState(getISTToday());
  const [history, setHistory] = useState([]);
  const [historyTotal, setHistoryTotal] = useState(0);

  // Close day dialog
  const [showCloseDialog, setShowCloseDialog] = useState(false);
  const [closingCashInput, setClosingCashInput] = useState("");
  const [closing, setClosing] = useState(false);

  // Add expense form
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [expenseForm, setExpenseForm] = useState({ category: "", amount: "", type: "out", notes: "" });
  const [savingExpense, setSavingExpense] = useState(false);

  // Edit opening cash
  const [editingOpening, setEditingOpening] = useState(false);
  const [openingInput, setOpeningInput] = useState("");

  // Fund pots
  const [fundPots, setFundPots] = useState([]);
  const [showPayoutDialog, setShowPayoutDialog] = useState(false);
  const [payoutForm, setPayoutForm] = useState({ category: "", amount: "", notes: "" });
  const [payingOut, setPayingOut] = useState(false);

  // Funds tab state
  const [fundTransactions, setFundTransactions] = useState([]);
  const [selectedPot, setSelectedPot] = useState(null);
  const [fundsLoading, setFundsLoading] = useState(false);

  // Auth check
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) { router.replace("/"); return; }
    authAPI.me().then(() => setIsAuth(true)).catch(() => router.replace("/"));
  }, [router]);

  // Load data
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const today = getISTToday();
      const result = selectedDate === today
        ? await cashbookAPI.getToday()
        : await cashbookAPI.getByDate(selectedDate);
      setData(result);
    } catch (err) {
      console.error("Failed to load cash book:", err);
    }
    try {
      const fundData = await fundsAPI.summary();
      setFundPots(fundData?.pots || []);
    } catch {}
    setLoading(false);
  }, [selectedDate]);

  const fetchHistory = useCallback(async () => {
    try {
      const result = await cashbookAPI.history({ limit: 30 });
      setHistory(result?.entries || []);
      setHistoryTotal(result?.total || 0);
    } catch (err) {
      console.error("Failed to load history:", err);
    }
  }, []);

  const fetchFunds = useCallback(async () => {
    setFundsLoading(true);
    try {
      const [summaryRes, txRes] = await Promise.all([
        fundsAPI.summary(),
        fundsAPI.transactions({ limit: 100, ...(selectedPot ? { category: selectedPot } : {}) }),
      ]);
      setFundPots(summaryRes?.pots || []);
      setFundTransactions(txRes?.transactions || []);
    } catch (err) {
      console.error("Failed to load funds:", err);
    }
    setFundsLoading(false);
  }, [selectedPot]);

  useEffect(() => {
    if (!isAuth) return;
    if (activeTab === "today") fetchData();
    else if (activeTab === "history") fetchHistory();
    else if (activeTab === "funds") fetchFunds();
  }, [isAuth, activeTab, selectedDate, fetchData, fetchHistory, fetchFunds]);

  // Close day
  const handleCloseDay = async () => {
    const amount = parseFloat(closingCashInput);
    if (isNaN(amount) || amount < 0) return;
    setClosing(true);
    try {
      await cashbookAPI.close(selectedDate, { closingCash: amount });
      setShowCloseDialog(false);
      setClosingCashInput("");
      fetchData();
    } catch (err) {
      alert(err.message || "Failed to close day");
    }
    setClosing(false);
  };

  // Reopen day
  const handleReopen = async () => {
    if (!confirm("Reopen this day's cash book?")) return;
    try {
      await cashbookAPI.reopen(selectedDate);
      fetchData();
    } catch (err) {
      alert(err.message || "Failed to reopen");
    }
  };

  // Update opening cash
  const handleUpdateOpening = async () => {
    const amount = parseFloat(openingInput);
    if (isNaN(amount) || amount < 0) return;
    try {
      await cashbookAPI.update(selectedDate, { openingCash: amount });
      setEditingOpening(false);
      fetchData();
    } catch (err) {
      alert(err.message || "Failed to update");
    }
  };

  // Add expense
  const handleAddExpense = async () => {
    if (!expenseForm.category || !expenseForm.amount) return;
    setSavingExpense(true);
    try {
      await expensesAPI.create({
        category: expenseForm.category,
        amount: Number(expenseForm.amount),
        type: expenseForm.type,
        method: "Cash",
        date: selectedDate,
        notes: expenseForm.notes,
      });
      setExpenseForm({ category: "", amount: "", type: "out", notes: "" });
      setShowAddExpense(false);
      fetchData();
    } catch (err) {
      alert(err.message || "Failed to add");
    }
    setSavingExpense(false);
  };

  // Delete expense
  const handleDeleteExpense = async (id) => {
    if (!confirm("Delete this entry?")) return;
    try {
      await expensesAPI.delete(id);
      fetchData();
    } catch (err) {
      alert(err.message || "Failed to delete");
    }
  };

  const isToday = selectedDate === getISTToday();
  const isOpen = data?.status === "open";

  return (
    <div className="min-h-[100dvh] bg-gray-50">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-coffee-dark text-cream px-4 py-3 flex items-center gap-3">
        <button onClick={() => router.push("/pages/order")} className="p-1 hover:bg-white/10 rounded-lg">
          <HiArrowLeft className="w-5 h-5" />
        </button>
        <HiCash className="w-6 h-6" />
        <h1 className="text-lg font-bold flex-1">Cash Book</h1>
        <button onClick={fetchData} className="p-2 hover:bg-white/10 rounded-lg">
          <HiRefresh className="w-5 h-5" />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 bg-white">
        {[["today", "Daily View"], ["history", "History"], ["funds", "Funds"]].map(([tab, label]) => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`flex-1 py-3 text-sm font-bold transition ${
              activeTab === tab ? "text-coffee border-b-2 border-coffee" : "text-gray-400"
            }`}>{label}</button>
        ))}
      </div>

      {activeTab === "today" ? (
        <div className="p-4 space-y-4 max-w-2xl mx-auto">
          {/* Date selector */}
          <div className="flex items-center gap-3">
            <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)}
              className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm" />
            <span className={`px-3 py-1 rounded-full text-xs font-bold ${
              data?.status === "closed" ? "bg-gray-200 text-gray-600" : "bg-green-100 text-green-700"
            }`}>
              {data?.status === "closed" ? "Closed" : "Open"}
            </span>
          </div>

          {loading ? (
            <div className="text-center py-12 text-gray-400">Loading...</div>
          ) : data ? (
            <>
              {/* Opening Cash */}
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold text-blue-500 uppercase">Opening Cash</p>
                    {editingOpening ? (
                      <div className="flex items-center gap-2 mt-1">
                        <input type="number" value={openingInput} onChange={(e) => setOpeningInput(e.target.value)}
                          className="w-32 px-2 py-1 border rounded text-lg font-bold" autoFocus />
                        <button onClick={handleUpdateOpening} className="text-green-600 font-bold text-sm">Save</button>
                        <button onClick={() => setEditingOpening(false)} className="text-gray-400 text-sm">Cancel</button>
                      </div>
                    ) : (
                      <p className="text-2xl font-bold text-blue-700">{"\u20B9"}{(data.openingCash || 0).toLocaleString("en-IN")}</p>
                    )}
                  </div>
                  {isOpen && !editingOpening && (
                    <button onClick={() => { setOpeningInput(String(data.openingCash || 0)); setEditingOpening(true); }}
                      className="p-2 hover:bg-blue-100 rounded-lg">
                      <HiPencil className="w-4 h-4 text-blue-500" />
                    </button>
                  )}
                </div>
              </div>

              {/* Cash In */}
              <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                <p className="text-xs font-bold text-green-600 uppercase mb-3 flex items-center gap-1">
                  <HiTrendingUp className="w-4 h-4" /> Cash In
                </p>
                <div className="space-y-2">
                  <div className="flex justify-between items-center bg-white rounded-lg p-3 border border-green-100">
                    <div>
                      <p className="text-sm font-semibold text-gray-800">Cash Sales</p>
                      <p className="text-xs text-gray-400">{data.cashSales?.count || 0} orders</p>
                    </div>
                    <p className="text-lg font-bold text-green-600">{"\u20B9"}{(data.cashSales?.total || 0).toLocaleString("en-IN")}</p>
                  </div>
                  {(data.cashIn?.entries || []).map((e) => (
                    <div key={e._id} className="flex justify-between items-center bg-white rounded-lg p-3 border border-green-100">
                      <div>
                        <p className="text-sm font-semibold text-gray-800">{e.category}</p>
                        <p className="text-xs text-gray-400">{e.notes || "Cash in"}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-bold text-green-600">{"\u20B9"}{e.amount.toLocaleString("en-IN")}</p>
                        {isOpen && <button onClick={() => handleDeleteExpense(e._id)} className="text-red-400 hover:text-red-600"><HiTrash className="w-4 h-4" /></button>}
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-right mt-2 text-sm font-bold text-green-700">
                  Total In: {"\u20B9"}{((data.cashSales?.total || 0) + (data.cashIn?.total || 0)).toLocaleString("en-IN")}
                </p>
              </div>

              {/* Cash Out */}
              <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                <p className="text-xs font-bold text-red-600 uppercase mb-3 flex items-center gap-1">
                  <HiTrendingDown className="w-4 h-4" /> Cash Out
                </p>
                <div className="space-y-2">
                  {(data.cashOut?.entries || []).map((e) => (
                    <div key={e._id} className="flex justify-between items-center bg-white rounded-lg p-3 border border-red-100">
                      <div className="flex items-center gap-2">
                        {e.source === "fixed" && <span className="text-[9px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-bold">FIXED</span>}
                        <div>
                          <p className="text-sm font-semibold text-gray-800">{e.category}</p>
                          <p className="text-xs text-gray-400">{e.notes || "Expense"}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-bold text-red-600">{"\u20B9"}{e.amount.toLocaleString("en-IN")}</p>
                        {isOpen && <button onClick={() => handleDeleteExpense(e._id)} className="text-red-400 hover:text-red-600"><HiTrash className="w-4 h-4" /></button>}
                      </div>
                    </div>
                  ))}
                  {data.purchases?.count > 0 && (
                    <div className="flex justify-between items-center bg-white rounded-lg p-3 border border-red-100">
                      <div>
                        <p className="text-sm font-semibold text-gray-800">Purchases</p>
                        <p className="text-xs text-gray-400">{data.purchases.count} purchase(s)</p>
                      </div>
                      <p className="text-sm font-bold text-red-600">{"\u20B9"}{(data.purchases.total || 0).toLocaleString("en-IN")}</p>
                    </div>
                  )}
                </div>
                {isOpen && (
                  <button onClick={() => setShowAddExpense(true)}
                    className="mt-3 w-full py-2 border-2 border-dashed border-red-200 rounded-lg text-red-500 text-sm font-bold hover:bg-red-50 flex items-center justify-center gap-1">
                    <HiPlus className="w-4 h-4" /> Add Expense
                  </button>
                )}
                <p className="text-right mt-2 text-sm font-bold text-red-700">
                  Total Out: {"\u20B9"}{((data.cashOut?.total || 0) + (data.purchases?.total || 0)).toLocaleString("en-IN")}
                </p>
              </div>

              {/* Fund Pots - Daily Savings */}
              {fundPots.length > 0 && (
                <div className="bg-purple-50 border border-purple-200 rounded-xl p-4">
                  <p className="text-xs font-bold text-purple-600 uppercase mb-3 flex items-center gap-1">
                    <HiCash className="w-4 h-4" /> Saved Funds
                  </p>
                  <div className="space-y-2">
                    {fundPots.map((pot) => (
                      <div key={pot._id} className="flex justify-between items-center bg-white rounded-lg p-3 border border-purple-100">
                        <div>
                          <p className="text-sm font-semibold text-gray-800">{pot.category}</p>
                          <p className="text-[10px] text-gray-400">Total saved: {"\u20B9"}{pot.totalAllocated?.toLocaleString("en-IN")} | Paid: {"\u20B9"}{pot.totalPaidOut?.toLocaleString("en-IN")}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-bold text-purple-700">{"\u20B9"}{pot.balance?.toLocaleString("en-IN")}</p>
                          {isOpen && pot.balance > 0 && (
                            <button onClick={() => { setPayoutForm({ category: pot.category, amount: "", notes: "" }); setShowPayoutDialog(true); }}
                              className="text-[10px] bg-purple-100 text-purple-700 px-2 py-1 rounded font-bold hover:bg-purple-200">Pay</button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-2 text-right">
                    <p className="text-sm font-bold text-purple-700">
                      Total Saved: {"\u20B9"}{fundPots.reduce((s, p) => s + (p.balance || 0), 0).toLocaleString("en-IN")}
                    </p>
                  </div>
                </div>
              )}

              {/* Summary */}
              <div className="bg-coffee-dark text-cream rounded-xl p-5">
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between"><span className="opacity-70">Opening Cash</span><span className="font-bold">{"\u20B9"}{(data.openingCash || 0).toLocaleString("en-IN")}</span></div>
                  <div className="flex justify-between text-green-300"><span>+ Cash In</span><span className="font-bold">{"\u20B9"}{((data.cashSales?.total || 0) + (data.cashIn?.total || 0)).toLocaleString("en-IN")}</span></div>
                  <div className="flex justify-between text-red-300"><span>- Cash Out</span><span className="font-bold">{"\u20B9"}{((data.cashOut?.total || 0) + (data.purchases?.total || 0)).toLocaleString("en-IN")}</span></div>
                  {fundPots.length > 0 && (
                    <div className="flex justify-between text-purple-300"><span>Funds Saved</span><span className="font-bold">{"\u20B9"}{fundPots.reduce((s, p) => s + (p.balance || 0), 0).toLocaleString("en-IN")}</span></div>
                  )}
                  <div className="border-t border-cream/20 pt-2 flex justify-between text-xl">
                    <span className="font-bold">Cash in Hand</span>
                    <span className="font-bold">{"\u20B9"}{(data.calculatedClosing || 0).toLocaleString("en-IN")}</span>
                  </div>
                </div>
                {data.status === "closed" && data.closingCash != null && (
                  <div className="mt-3 pt-3 border-t border-cream/20 space-y-1 text-sm">
                    <div className="flex justify-between"><span className="opacity-70">Actual Counted</span><span className="font-bold">{"\u20B9"}{data.closingCash.toLocaleString("en-IN")}</span></div>
                    <div className="flex justify-between">
                      <span className="opacity-70">Difference</span>
                      <span className={`font-bold ${data.closingCash - data.calculatedClosing >= 0 ? "text-green-300" : "text-red-300"}`}>
                        {"\u20B9"}{(data.closingCash - data.calculatedClosing).toLocaleString("en-IN")}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3">
                {isOpen ? (
                  <button onClick={() => { setClosingCashInput(String(Math.round(data.calculatedClosing || 0))); setShowCloseDialog(true); }}
                    className="flex-1 py-3 bg-coffee text-cream font-bold rounded-xl hover:bg-coffee-dark transition flex items-center justify-center gap-2">
                    <HiLockClosed className="w-5 h-5" /> Close Day
                  </button>
                ) : (
                  <button onClick={handleReopen}
                    className="flex-1 py-3 bg-gray-200 text-gray-700 font-bold rounded-xl hover:bg-gray-300 transition flex items-center justify-center gap-2">
                    <HiLockOpen className="w-5 h-5" /> Reopen Day
                  </button>
                )}
              </div>
            </>
          ) : (
            <div className="text-center py-12 text-gray-400">No data</div>
          )}
        </div>
      ) : activeTab === "history" ? (
        /* History Tab */
        <div className="p-4 max-w-2xl mx-auto space-y-3">
          {history.length === 0 ? (
            <p className="text-center py-12 text-gray-400">No history yet</p>
          ) : history.map((entry) => (
            <button key={entry.date} onClick={() => { setSelectedDate(entry.date); setActiveTab("today"); }}
              className="w-full bg-white border border-gray-200 rounded-xl p-4 text-left hover:shadow-md transition">
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-sm text-gray-800">{entry.date}</span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                  entry.status === "closed" ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"
                }`}>{entry.status}</span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div><span className="text-gray-400">Opening</span><p className="font-bold text-gray-700">{"\u20B9"}{(entry.openingCash || 0).toLocaleString("en-IN")}</p></div>
                <div><span className="text-gray-400">Closing</span><p className="font-bold text-gray-700">{entry.closingCash != null ? `\u20B9${entry.closingCash.toLocaleString("en-IN")}` : "\u2014"}</p></div>
                <div><span className="text-gray-400">Sales</span><p className="font-bold text-green-600">{"\u20B9"}{(entry.totalCashSales || 0).toLocaleString("en-IN")}</p></div>
              </div>
            </button>
          ))}
        </div>
      ) : (
        /* Funds Tab */
        <div className="p-4 max-w-2xl mx-auto space-y-4">
          {/* Fund Pots Summary */}
          {fundsLoading ? (
            <div className="text-center py-12 text-gray-400">Loading...</div>
          ) : (
            <>
              {/* Total Saved Banner */}
              <div className="bg-purple-600 text-white rounded-xl p-5 text-center">
                <p className="text-xs opacity-70 uppercase font-bold">Total Funds Saved</p>
                <p className="text-3xl font-bold font-mono mt-1">
                  {"\u20B9"}{fundPots.reduce((s, p) => s + (p.balance || 0), 0).toLocaleString("en-IN")}
                </p>
                <p className="text-xs opacity-60 mt-1">
                  Allocated: {"\u20B9"}{fundPots.reduce((s, p) => s + (p.totalAllocated || 0), 0).toLocaleString("en-IN")} | Paid Out: {"\u20B9"}{fundPots.reduce((s, p) => s + (p.totalPaidOut || 0), 0).toLocaleString("en-IN")}
                </p>
              </div>

              {/* Individual Pot Cards */}
              <div className="space-y-3">
                {fundPots.length === 0 ? (
                  <p className="text-center py-8 text-gray-400 text-sm">No fund pots configured. Go to Settings to add fixed daily expenses with "Fund" enabled.</p>
                ) : fundPots.map((pot) => (
                  <div key={pot._id} className={`bg-white border-2 rounded-xl p-4 transition ${selectedPot === pot.category ? "border-purple-400 shadow-md" : "border-gray-200"}`}>
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <p className="font-bold text-gray-800">{pot.category}</p>
                        <p className="text-[10px] text-gray-400">
                          Total saved: {"\u20B9"}{(pot.totalAllocated || 0).toLocaleString("en-IN")} | Paid out: {"\u20B9"}{(pot.totalPaidOut || 0).toLocaleString("en-IN")}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xl font-bold text-purple-700">{"\u20B9"}{(pot.balance || 0).toLocaleString("en-IN")}</p>
                        <button onClick={() => { setPayoutForm({ category: pot.category, amount: "", notes: "" }); setShowPayoutDialog(true); }}
                          className="text-[10px] bg-purple-100 text-purple-700 px-3 py-1 rounded-full font-bold hover:bg-purple-200 mt-1">
                          Pay Out
                        </button>
                      </div>
                    </div>
                    {/* Progress bar */}
                    <div className="w-full bg-gray-100 rounded-full h-2">
                      <div className="bg-purple-500 h-2 rounded-full transition-all" style={{ width: `${pot.totalAllocated > 0 ? Math.min(100, (pot.balance / pot.totalAllocated) * 100) : 0}%` }} />
                    </div>
                    <div className="flex justify-between text-[9px] text-gray-400 mt-1">
                      <span>Remaining: {pot.totalAllocated > 0 ? Math.round((pot.balance / pot.totalAllocated) * 100) : 0}%</span>
                      <button onClick={() => setSelectedPot(selectedPot === pot.category ? null : pot.category)}
                        className="text-purple-600 font-bold hover:underline">
                        {selectedPot === pot.category ? "Hide History" : "View History"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Transaction History */}
              <div className="bg-white border border-gray-200 rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-bold text-gray-800">
                    {selectedPot ? `${selectedPot} — Transactions` : "All Fund Transactions"}
                  </p>
                  {selectedPot && (
                    <button onClick={() => setSelectedPot(null)} className="text-xs text-purple-600 font-bold hover:underline">Show All</button>
                  )}
                </div>
                {fundTransactions.length === 0 ? (
                  <p className="text-center py-6 text-gray-400 text-sm">No transactions yet</p>
                ) : (
                  <div className="space-y-2 max-h-[50vh] overflow-y-auto">
                    {fundTransactions.map((tx, idx) => (
                      <div key={tx._id || idx} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${tx.type === "allocation" ? "bg-green-500" : "bg-red-500"}`} />
                          <div>
                            <p className="text-sm font-semibold text-gray-800">
                              {tx.type === "allocation" ? "Daily Allocation" : "Payout"}
                              {!selectedPot && <span className="text-gray-400 font-normal"> — {tx.potCategory}</span>}
                            </p>
                            <p className="text-[10px] text-gray-400">{tx.date} {tx.notes && `· ${tx.notes}`}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className={`text-sm font-bold ${tx.type === "allocation" ? "text-green-600" : "text-red-600"}`}>
                            {tx.type === "allocation" ? "+" : "-"}{"\u20B9"}{tx.amount?.toLocaleString("en-IN")}
                          </p>
                          <p className="text-[9px] text-gray-400">Bal: {"\u20B9"}{tx.balanceAfter?.toLocaleString("en-IN")}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* Close Day Dialog */}
      {showCloseDialog && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowCloseDialog(false)}>
          <div className="bg-white rounded-2xl p-5 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold mb-1">Close Day</h3>
            <p className="text-xs text-gray-400 mb-4">Enter the actual cash counted in the drawer</p>
            <div className="mb-3">
              <label className="text-xs font-bold text-gray-500 uppercase">Expected Cash</label>
              <p className="text-xl font-bold text-coffee">{"\u20B9"}{Math.round(data?.calculatedClosing || 0).toLocaleString("en-IN")}</p>
            </div>
            <div className="mb-4">
              <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Actual Cash Counted</label>
              <input type="number" value={closingCashInput} onChange={(e) => setClosingCashInput(e.target.value)}
                className="w-full p-3 border-2 border-gray-300 rounded-xl text-xl font-bold text-center focus:ring-2 focus:ring-coffee focus:border-coffee outline-none"
                autoFocus />
            </div>
            {closingCashInput && (
              <div className={`mb-4 p-3 rounded-lg text-sm font-bold text-center ${
                parseFloat(closingCashInput) - (data?.calculatedClosing || 0) >= 0 ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
              }`}>
                Difference: {"\u20B9"}{(parseFloat(closingCashInput || 0) - (data?.calculatedClosing || 0)).toLocaleString("en-IN")}
              </div>
            )}
            <div className="flex gap-2">
              <button onClick={() => setShowCloseDialog(false)} className="flex-1 py-3 border border-gray-300 rounded-xl font-bold text-gray-600">Cancel</button>
              <button onClick={handleCloseDay} disabled={closing}
                className="flex-1 py-3 bg-coffee text-cream rounded-xl font-bold hover:bg-coffee-dark disabled:opacity-50">
                {closing ? "Closing..." : "Confirm Close"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Expense Dialog */}
      {showAddExpense && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowAddExpense(false)}>
          <div className="bg-white rounded-2xl p-5 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold mb-4">Add Expense</h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Type</label>
                <div className="flex gap-2">
                  <button onClick={() => setExpenseForm({...expenseForm, type: "out"})}
                    className={`flex-1 py-2 rounded-lg text-sm font-bold ${expenseForm.type === "out" ? "bg-red-500 text-white" : "bg-gray-100 text-gray-600"}`}>Expense (Out)</button>
                  <button onClick={() => setExpenseForm({...expenseForm, type: "in"})}
                    className={`flex-1 py-2 rounded-lg text-sm font-bold ${expenseForm.type === "in" ? "bg-green-500 text-white" : "bg-gray-100 text-gray-600"}`}>Income (In)</button>
                </div>
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Category</label>
                <input type="text" value={expenseForm.category} onChange={(e) => setExpenseForm({...expenseForm, category: e.target.value})}
                  placeholder="e.g. Grocery, Milk, Wages..." className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Amount</label>
                <input type="number" value={expenseForm.amount} onChange={(e) => setExpenseForm({...expenseForm, amount: e.target.value})}
                  placeholder="\u20B90" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Notes (optional)</label>
                <input type="text" value={expenseForm.notes} onChange={(e) => setExpenseForm({...expenseForm, notes: e.target.value})}
                  placeholder="Optional notes" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={() => setShowAddExpense(false)} className="flex-1 py-3 border border-gray-300 rounded-xl font-bold text-gray-600">Cancel</button>
              <button onClick={handleAddExpense} disabled={savingExpense || !expenseForm.category || !expenseForm.amount}
                className="flex-1 py-3 bg-coffee text-cream rounded-xl font-bold hover:bg-coffee-dark disabled:opacity-50">
                {savingExpense ? "Saving..." : "Add"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Payout Dialog */}
      {showPayoutDialog && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowPayoutDialog(false)}>
          <div className="bg-white rounded-2xl p-5 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold mb-1">Pay from Fund</h3>
            <p className="text-xs text-gray-400 mb-4">Paying from <span className="font-bold text-purple-700">{payoutForm.category}</span> pot</p>
            <div className="mb-3">
              <label className="text-xs font-bold text-gray-500 uppercase">Available Balance</label>
              <p className="text-xl font-bold text-purple-700">{"\u20B9"}{(fundPots.find(p => p.category === payoutForm.category)?.balance || 0).toLocaleString("en-IN")}</p>
            </div>
            <div className="mb-3">
              <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Amount to Pay</label>
              <input type="number" value={payoutForm.amount} onChange={(e) => setPayoutForm({...payoutForm, amount: e.target.value})}
                className="w-full p-3 border-2 border-gray-300 rounded-xl text-xl font-bold text-center focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none" autoFocus />
            </div>
            <div className="mb-4">
              <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Notes</label>
              <input type="text" value={payoutForm.notes} onChange={(e) => setPayoutForm({...payoutForm, notes: e.target.value})}
                placeholder="e.g. March rent paid" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
            </div>
            <div className="flex gap-2">
              <button onClick={() => setShowPayoutDialog(false)} className="flex-1 py-3 border border-gray-300 rounded-xl font-bold text-gray-600">Cancel</button>
              <button onClick={async () => {
                const amount = parseFloat(payoutForm.amount);
                if (!amount || amount <= 0) return;
                setPayingOut(true);
                try {
                  await fundsAPI.payout({ category: payoutForm.category, amount, notes: payoutForm.notes });
                  setShowPayoutDialog(false);
                  setPayoutForm({ category: "", amount: "", notes: "" });
                  fetchData();
                } catch (err) {
                  alert(err.message || "Payout failed");
                }
                setPayingOut(false);
              }} disabled={payingOut || !payoutForm.amount}
                className="flex-1 py-3 bg-purple-600 text-white rounded-xl font-bold hover:bg-purple-700 disabled:opacity-50">
                {payingOut ? "Processing..." : "Pay Out"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <p className="text-center text-[10px] text-gray-300 py-4">&copy; 2026 EndlessScript. All rights reserved.</p>
    </div>
  );
}
