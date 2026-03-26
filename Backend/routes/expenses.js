const express = require("express");
const router = express.Router();
const Expense = require("../models/Expense");
const { verifyToken } = require("../middleware/auth");
const roleCheck = require("../middleware/roleCheck");
const asyncHandler = require("../middleware/asyncHandler");
const { logAudit } = require("../config/audit");

// GET /api/expenses — list expenses with pagination (auth required)
router.get(
  "/",
  verifyToken,
  asyncHandler(async (req, res) => {
    const { date, type, page = 1, limit = 100 } = req.query;
    const filter = {};
    if (date) filter.date = String(date);
    if (type) filter.type = String(type);

    const pageNum = Math.max(1, Number(page));
    const limitNum = Math.min(Math.max(1, Number(limit)), 500);

    const [expenses, total] = await Promise.all([
      Expense.find(filter).sort({ createdAt: -1 }).skip((pageNum - 1) * limitNum).limit(limitNum),
      Expense.countDocuments(filter),
    ]);

    res.json({ success: true, data: { expenses, total, page: pageNum, pages: Math.ceil(total / limitNum) } });
  })
);

// GET /api/expenses/today — today's expenses (auth required)
router.get(
  "/today",
  verifyToken,
  asyncHandler(async (req, res) => {
    const now = new Date();
    const ist = new Date(now.getTime() + (5.5 * 60 * 60 * 1000));
    const today = ist.toISOString().split("T")[0];
    const expenses = await Expense.find({ date: today });

    const totalIn = expenses
      .filter((e) => e.type === "in")
      .reduce((sum, e) => sum + e.amount, 0);
    const totalOut = expenses
      .filter((e) => e.type === "out")
      .reduce((sum, e) => sum + e.amount, 0);

    res.json({ success: true, data: { date: today, expenses, totalIn, totalOut, balance: totalIn - totalOut } });
  })
);

// POST /api/expenses — add expense (auth required)
router.post(
  "/",
  verifyToken,
  asyncHandler(async (req, res) => {
    const { category, amount, notes, type, method, date } = req.body;
    if (!category || amount === undefined || !date) {
      return res.status(400).json({ success: false, error: "Missing required fields: category, amount, date" });
    }

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount < 0) {
      return res.status(400).json({ success: false, error: "Amount must be a valid non-negative number" });
    }

    const expense = await Expense.create({
      category,
      amount: parsedAmount,
      notes: notes || "",
      type: (type || "out").toLowerCase(),
      method: method || "Cash",
      date,
    });

    await logAudit({ action: "create", entity: "Expense", entityId: expense._id, user: req.user, details: { category, amount: parsedAmount } });

    res.status(201).json({ success: true, data: expense });
  })
);

// PUT /api/expenses/:id — update expense (auth required)
router.put(
  "/:id",
  verifyToken,
  asyncHandler(async (req, res) => {
    const { category, amount, notes, type, method, date } = req.body;
    const update = {};
    if (category !== undefined) update.category = category;
    if (amount !== undefined) {
      const parsedAmount = parseFloat(amount);
      if (isNaN(parsedAmount) || parsedAmount < 0) {
        return res.status(400).json({ success: false, error: "Amount must be a valid non-negative number" });
      }
      update.amount = parsedAmount;
    }
    if (notes !== undefined) update.notes = notes;
    if (type !== undefined) update.type = type.toLowerCase();
    if (method !== undefined) update.method = method;
    if (date !== undefined) update.date = date;

    const expense = await Expense.findByIdAndUpdate(req.params.id, update, { new: true, runValidators: true });
    if (!expense) return res.status(404).json({ success: false, error: "Expense not found" });

    await logAudit({ action: "update", entity: "Expense", entityId: expense._id, user: req.user });

    res.json({ success: true, data: expense });
  })
);

// DELETE /api/expenses/:id — delete expense (admin/manager only)
router.delete(
  "/:id",
  verifyToken,
  roleCheck("admin", "manager"),
  asyncHandler(async (req, res) => {
    const expense = await Expense.findByIdAndDelete(req.params.id);
    if (!expense) return res.status(404).json({ success: false, error: "Expense not found" });

    await logAudit({ action: "delete", entity: "Expense", entityId: req.params.id, user: req.user });

    res.json({ success: true, message: "Expense deleted" });
  })
);

module.exports = router;
