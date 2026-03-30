const express = require("express");
const router = express.Router();
const DailyCashBook = require("../models/DailyCashBook");
const Order = require("../models/Order");
const Expense = require("../models/Expense");
const Purchase = require("../models/Purchase");
const Settings = require("../models/Settings");
const FundPot = require("../models/FundPot");
const FundTransaction = require("../models/FundTransaction");
const { verifyToken } = require("../middleware/auth");
const roleCheck = require("../middleware/roleCheck");
const asyncHandler = require("../middleware/asyncHandler");
const { logAudit } = require("../config/audit");

function getISTToday() {
  const now = new Date();
  const ist = new Date(now.getTime() + (5.5 * 60 * 60 * 1000));
  return ist.toISOString().split("T")[0];
}

async function aggregateCashBook(dateStr) {
  // Cash sales
  const cashOrders = await Order.find({ date: dateStr, paymentMethod: { $regex: /^cash$/i }, status: "completed" });
  const cashSalesTotal = cashOrders.reduce((s, o) => s + o.grandTotal, 0);

  // UPI sales
  const upiOrders = await Order.find({ date: dateStr, paymentMethod: { $regex: /^upi$/i }, status: "completed" });
  const upiSalesTotal = upiOrders.reduce((s, o) => s + o.grandTotal, 0);

  // Card sales
  const cardOrders = await Order.find({ date: dateStr, paymentMethod: { $regex: /^card$/i }, status: "completed" });
  const cardSalesTotal = cardOrders.reduce((s, o) => s + o.grandTotal, 0);

  // Other sales
  const otherOrders = await Order.find({ date: dateStr, paymentMethod: { $nin: [/^cash$/i, /^upi$/i, /^card$/i] }, status: "completed" });
  const otherSalesTotal = otherOrders.reduce((s, o) => s + o.grandTotal, 0);

  // All expenses for the day
  const expenses = await Expense.find({ date: dateStr });
  const cashOutEntries = expenses.filter(e => e.type === "out");
  const cashInEntries = expenses.filter(e => e.type === "in");
  const totalCashOut = cashOutEntries.reduce((s, e) => s + e.amount, 0);
  const totalCashIn = cashInEntries.reduce((s, e) => s + e.amount, 0);

  // Purchases (date is Date type, need IST range)
  const dayStart = new Date(`${dateStr}T00:00:00+05:30`);
  const dayEnd = new Date(`${dateStr}T23:59:59.999+05:30`);
  const purchases = await Purchase.find({ date: { $gte: dayStart, $lte: dayEnd } });
  const totalPurchases = purchases.reduce((s, p) => s + (p.grandTotal || 0), 0);

  // Fund pot totals
  const fundPots = await FundPot.find().sort({ category: 1 });
  const totalFundsSaved = fundPots.reduce((s, p) => s + p.balance, 0);

  return {
    cashSales: { total: cashSalesTotal, count: cashOrders.length },
    upiSales: { total: upiSalesTotal, count: upiOrders.length },
    cardSales: { total: cardSalesTotal, count: cardOrders.length },
    otherSales: { total: otherSalesTotal, count: otherOrders.length },
    cashIn: { total: totalCashIn, entries: cashInEntries },
    cashOut: { total: totalCashOut, entries: cashOutEntries },
    purchases: { total: totalPurchases, count: purchases.length, entries: purchases },
    fundPots,
    totalFundsSaved,
  };
}

// GET /api/cashbook/today
router.get("/today", verifyToken, asyncHandler(async (req, res) => {
  const dateStr = getISTToday();

  let cashbook = await DailyCashBook.findOne({ date: dateStr });

  if (!cashbook) {
    // Get previous day's closing as opening
    const prev = await DailyCashBook.findOne({ status: "closed" }).sort({ date: -1 });
    const openingCash = prev ? prev.closingCash : 0;

    cashbook = await DailyCashBook.create({ date: dateStr, openingCash });
  }

  // Auto-generate fixed expenses if not done yet
  if (!cashbook.fixedExpensesGenerated) {
    const settings = await Settings.getSettings();
    const fixedExpenses = (settings.fixedDailyExpenses || []).filter(f => f.active);

    for (const fe of fixedExpenses) {
      // Check if already exists (safety)
      const exists = await Expense.findOne({ date: dateStr, category: fe.category, source: "fixed" });
      if (!exists) {
        if (fe.isFund) {
          // Fund allocation: update pot balance and record transaction
          const pot = await FundPot.findOneAndUpdate(
            { category: fe.category },
            { $inc: { balance: fe.amount, totalAllocated: fe.amount } },
            { upsert: true, new: true }
          );

          await FundTransaction.create({
            potCategory: fe.category,
            type: "allocation",
            amount: fe.amount,
            date: dateStr,
            notes: "Daily allocation",
            balanceAfter: pot.balance,
            userId: req.user?.id,
          });

          // Also create an Expense so it shows in cash out
          await Expense.create({
            category: fe.category,
            amount: fe.amount,
            type: "out",
            method: "Cash",
            date: dateStr,
            source: "fixed",
            notes: `Fund: ${fe.category}`,
          });
        } else {
          // Direct expense (original behavior)
          await Expense.create({
            category: fe.category,
            amount: fe.amount,
            type: "out",
            method: "Cash",
            date: dateStr,
            source: "fixed",
            notes: "Auto: Fixed daily expense",
          });
        }
      }
    }

    cashbook.fixedExpensesGenerated = true;
    await cashbook.save();
  }

  const agg = await aggregateCashBook(dateStr);
  const effectiveCash = cashbook.manualCashAmount != null ? cashbook.manualCashAmount : agg.cashSales.total;
  const calculatedClosing = cashbook.openingCash + effectiveCash + agg.cashIn.total - agg.cashOut.total - agg.purchases.total;

  res.json({
    success: true,
    data: {
      ...cashbook.toObject(),
      ...agg,
      calculatedClosing,
    },
  });
}));

// GET /api/cashbook/history
router.get("/history", verifyToken, asyncHandler(async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 30, 100);
  const skip = Math.max(0, parseInt(req.query.skip) || 0);

  const [entries, total] = await Promise.all([
    DailyCashBook.find().sort({ date: -1 }).limit(limit).skip(skip),
    DailyCashBook.countDocuments(),
  ]);

  res.json({ success: true, data: { entries, total } });
}));

// GET /api/cashbook/:date
router.get("/:date", verifyToken, asyncHandler(async (req, res) => {
  const dateStr = req.params.date;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return res.status(400).json({ success: false, error: "Invalid date format. Use YYYY-MM-DD" });
  }

  let cashbook = await DailyCashBook.findOne({ date: dateStr });
  if (!cashbook) {
    // Return aggregated data without creating a record
    const prev = await DailyCashBook.findOne({ date: { $lt: dateStr }, status: "closed" }).sort({ date: -1 });
    const openingCash = prev ? prev.closingCash : 0;

    const agg = await aggregateCashBook(dateStr);
    const calculatedClosing = openingCash + agg.cashSales.total + agg.cashIn.total - agg.cashOut.total - agg.purchases.total;

    return res.json({
      success: true,
      data: {
        date: dateStr, openingCash, closingCash: null, status: "open",
        notes: "", fixedExpensesGenerated: false,
        ...agg, calculatedClosing,
      },
    });
  }

  const agg = await aggregateCashBook(dateStr);
  const effectiveCash = cashbook.manualCashAmount != null ? cashbook.manualCashAmount : agg.cashSales.total;
  const calculatedClosing = cashbook.openingCash + effectiveCash + agg.cashIn.total - agg.cashOut.total - agg.purchases.total;

  res.json({
    success: true,
    data: { ...cashbook.toObject(), ...agg, calculatedClosing },
  });
}));

// PUT /api/cashbook/:date
router.put("/:date", verifyToken, roleCheck("admin", "manager"), asyncHandler(async (req, res) => {
  const { openingCash, notes } = req.body;
  const cashbook = await DailyCashBook.findOne({ date: req.params.date });
  if (!cashbook) return res.status(404).json({ success: false, error: "Cash book not found for this date" });
  if (cashbook.status === "closed") return res.status(400).json({ success: false, error: "Cash book is closed. Reopen first." });

  if (openingCash !== undefined) cashbook.openingCash = openingCash;
  if (notes !== undefined) cashbook.notes = notes;
  if (req.body.manualUpiAmount !== undefined) cashbook.manualUpiAmount = req.body.manualUpiAmount;
  if (req.body.manualCardAmount !== undefined) cashbook.manualCardAmount = req.body.manualCardAmount;
  if (req.body.manualCashAmount !== undefined) cashbook.manualCashAmount = req.body.manualCashAmount;
  if (req.body.denomination !== undefined) cashbook.denomination = req.body.denomination;
  await cashbook.save();

  await logAudit({ action: "update", entity: "DailyCashBook", entityId: cashbook._id, user: req.user });

  res.json({ success: true, data: cashbook });
}));

// POST /api/cashbook/:date/close
router.post("/:date/close", verifyToken, roleCheck("admin", "manager"), asyncHandler(async (req, res) => {
  const { closingCash } = req.body;
  if (closingCash === undefined || typeof closingCash !== "number") {
    return res.status(400).json({ success: false, error: "Closing cash amount required" });
  }

  const updateFields = {
    closingCash,
    status: "closed",
    closedBy: req.user.id,
    closedAt: new Date(),
  };
  if (req.body.denomination) updateFields.denomination = req.body.denomination;

  const cashbook = await DailyCashBook.findOneAndUpdate(
    { date: req.params.date, status: "open" },
    updateFields,
    { new: true }
  );

  if (!cashbook) return res.status(400).json({ success: false, error: "Cash book not found or already closed" });

  // Store totals for fast history
  const agg = await aggregateCashBook(req.params.date);
  cashbook.totalCashSales = agg.cashSales.total;
  cashbook.totalCashIn = agg.cashIn.total;
  cashbook.totalCashOut = agg.cashOut.total;
  cashbook.totalPurchases = agg.purchases.total;
  await cashbook.save();

  await logAudit({ action: "close", entity: "DailyCashBook", entityId: cashbook._id, user: req.user, details: { closingCash } });

  res.json({ success: true, data: cashbook });
}));

// POST /api/cashbook/:date/reopen
router.post("/:date/reopen", verifyToken, roleCheck("admin"), asyncHandler(async (req, res) => {
  const cashbook = await DailyCashBook.findOneAndUpdate(
    { date: req.params.date, status: "closed" },
    { status: "open", closingCash: null, closedBy: null, closedAt: null },
    { new: true }
  );

  if (!cashbook) return res.status(400).json({ success: false, error: "Cash book not found or already open" });

  await logAudit({ action: "reopen", entity: "DailyCashBook", entityId: cashbook._id, user: req.user });

  res.json({ success: true, data: cashbook });
}));

module.exports = router;
