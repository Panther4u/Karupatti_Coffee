const express = require("express");
const router = express.Router();
const FundPot = require("../models/FundPot");
const FundTransaction = require("../models/FundTransaction");
const Settings = require("../models/Settings");
const DailyCashBook = require("../models/DailyCashBook");
const { verifyToken } = require("../middleware/auth");
const roleCheck = require("../middleware/roleCheck");
const asyncHandler = require("../middleware/asyncHandler");
const { logAudit } = require("../config/audit");

function getISTToday() {
  const now = new Date();
  const ist = new Date(now.getTime() + (5.5 * 60 * 60 * 1000));
  return ist.toISOString().split("T")[0];
}

// GET /api/funds/pots — Get all fund pots with balances
router.get("/pots", verifyToken, asyncHandler(async (req, res) => {
  const pots = await FundPot.find().sort({ category: 1 });
  res.json({ success: true, data: pots });
}));

// POST /api/funds/allocate-daily — Allocate today's daily amounts to all active fund pots
router.post("/allocate-daily", verifyToken, asyncHandler(async (req, res) => {
  const dateStr = req.body.date || getISTToday();

  // Check if already allocated today
  const existingAlloc = await FundTransaction.findOne({ date: dateStr, type: "allocation" });
  if (existingAlloc) {
    return res.json({ success: true, data: { message: "Already allocated for this date", skipped: true } });
  }

  const settings = await Settings.getSettings();
  const fundItems = (settings.fixedDailyExpenses || []).filter(f => f.active && f.isFund);

  const results = [];
  for (const item of fundItems) {
    // Upsert the pot
    const pot = await FundPot.findOneAndUpdate(
      { category: item.category },
      {
        $inc: { balance: item.amount, totalAllocated: item.amount },
      },
      { upsert: true, new: true }
    );

    // Record transaction
    await FundTransaction.create({
      potCategory: item.category,
      type: "allocation",
      amount: item.amount,
      date: dateStr,
      notes: "Daily allocation",
      balanceAfter: pot.balance,
      userId: req.user?.id,
    });

    results.push({ category: item.category, amount: item.amount, newBalance: pot.balance });
  }

  res.json({ success: true, data: { allocated: results, date: dateStr } });
}));

// POST /api/funds/payout — Pay out from a fund pot (when actual bill comes)
router.post("/payout", verifyToken, roleCheck("admin", "manager"), asyncHandler(async (req, res) => {
  const { category, amount, notes } = req.body;

  if (!category || !amount || amount <= 0) {
    return res.status(400).json({ success: false, error: "Category and positive amount required" });
  }

  const pot = await FundPot.findOne({ category });
  if (!pot) {
    return res.status(404).json({ success: false, error: "Fund pot not found" });
  }
  if (pot.balance < amount) {
    return res.status(400).json({ success: false, error: `Insufficient balance. Available: ₹${pot.balance}` });
  }

  pot.balance -= amount;
  pot.totalPaidOut += amount;
  await pot.save();

  const dateStr = getISTToday();

  await FundTransaction.create({
    potCategory: category,
    type: "payout",
    amount,
    date: dateStr,
    notes: notes || `Paid ${category}`,
    balanceAfter: pot.balance,
    userId: req.user.id,
  });

  await logAudit({ action: "fund-payout", entity: "FundPot", entityId: pot._id, user: req.user, details: { category, amount } });

  res.json({ success: true, data: pot });
}));

// POST /api/funds/pots — Create a new fund pot
router.post("/pots", verifyToken, roleCheck("admin", "manager"), asyncHandler(async (req, res) => {
  const { category, initialAmount } = req.body;
  if (!category || !category.trim()) {
    return res.status(400).json({ success: false, error: "Fund name is required" });
  }

  const existing = await FundPot.findOne({ category: category.trim() });
  if (existing) {
    return res.status(400).json({ success: false, error: "Fund with this name already exists" });
  }

  const amount = parseFloat(initialAmount) || 0;
  const pot = await FundPot.create({
    category: category.trim(),
    balance: amount,
    totalAllocated: amount,
    totalPaidOut: 0,
  });

  if (amount > 0) {
    await FundTransaction.create({
      potCategory: pot.category,
      type: "allocation",
      amount,
      date: getISTToday(),
      notes: "Initial deposit",
      balanceAfter: pot.balance,
      userId: req.user?.id,
    });
  }

  await logAudit({ action: "create", entity: "FundPot", entityId: pot._id, user: req.user, details: { category: pot.category, initialAmount: amount } });

  res.status(201).json({ success: true, data: pot });
}));

// DELETE /api/funds/pots/:id — Delete a fund pot
router.delete("/pots/:id", verifyToken, roleCheck("admin", "manager"), asyncHandler(async (req, res) => {
  const pot = await FundPot.findByIdAndDelete(req.params.id);
  if (!pot) {
    return res.status(404).json({ success: false, error: "Fund pot not found" });
  }

  // Also delete related transactions
  await FundTransaction.deleteMany({ potCategory: pot.category });

  await logAudit({ action: "delete", entity: "FundPot", entityId: req.params.id, user: req.user, details: { category: pot.category } });

  res.json({ success: true, message: "Fund pot deleted" });
}));

// POST /api/funds/deposit — Manually add funds to a pot
router.post("/deposit", verifyToken, roleCheck("admin", "manager"), asyncHandler(async (req, res) => {
  const { category, amount, notes } = req.body;

  if (!category || !amount || amount <= 0) {
    return res.status(400).json({ success: false, error: "Category and positive amount required" });
  }

  const pot = await FundPot.findOne({ category });
  if (!pot) {
    return res.status(404).json({ success: false, error: "Fund pot not found" });
  }

  pot.balance += amount;
  pot.totalAllocated += amount;
  await pot.save();

  const dateStr = getISTToday();

  await FundTransaction.create({
    potCategory: category,
    type: "allocation",
    amount,
    date: dateStr,
    notes: notes || "Manual deposit",
    balanceAfter: pot.balance,
    userId: req.user?.id,
  });

  await logAudit({ action: "fund-deposit", entity: "FundPot", entityId: pot._id, user: req.user, details: { category, amount } });

  res.json({ success: true, data: pot });
}));

// GET /api/funds/transactions — Get fund transaction history
router.get("/transactions", verifyToken, asyncHandler(async (req, res) => {
  const { category, limit = 50, skip = 0 } = req.query;
  const filter = {};
  if (category) filter.potCategory = category;

  const [transactions, total] = await Promise.all([
    FundTransaction.find(filter).sort({ createdAt: -1 }).limit(Math.min(Number(limit), 200)).skip(Number(skip)),
    FundTransaction.countDocuments(filter),
  ]);

  res.json({ success: true, data: { transactions, total } });
}));

// GET /api/funds/summary — Get summary of all pots
router.get("/summary", verifyToken, asyncHandler(async (req, res) => {
  const pots = await FundPot.find().sort({ category: 1 });
  const totalSaved = pots.reduce((s, p) => s + p.balance, 0);
  const totalAllocated = pots.reduce((s, p) => s + p.totalAllocated, 0);
  const totalPaidOut = pots.reduce((s, p) => s + p.totalPaidOut, 0);

  res.json({
    success: true,
    data: { pots, totalSaved, totalAllocated, totalPaidOut },
  });
}));

module.exports = router;
