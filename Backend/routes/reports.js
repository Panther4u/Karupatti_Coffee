const express = require("express");
const router = express.Router();
const Order = require("../models/Order");
const Expense = require("../models/Expense");
const Product = require("../models/Product");
const { verifyToken } = require("../middleware/auth");
const asyncHandler = require("../middleware/asyncHandler");

// GET /api/reports/daily — daily report (auth required)
router.get(
  "/daily",
  verifyToken,
  asyncHandler(async (req, res) => {
    const date = req.query.date || new Date().toISOString().split("T")[0];

    const [orders, expenses, products] = await Promise.all([
      Order.find({ date, status: "completed" }),
      Expense.find({ date }),
      Product.find({}).select("_id purchaseRate"),
    ]);

    // Build product lookup
    const productMap = {};
    products.forEach((p) => {
      productMap[p._id.toString()] = { purchaseRate: p.purchaseRate || 0 };
    });

    // Sales summary by product
    const salesMap = {};
    for (const order of orders) {
      for (const item of order.order) {
        const key = item.name;
        const purchaseRate = item.productId
          ? productMap[item.productId.toString()]?.purchaseRate || 0
          : 0;
        const qty = item.amount;
        const totalSales = item.price * qty;
        const totalCost = purchaseRate * qty;

        if (!salesMap[key]) {
          salesMap[key] = {
            name: item.name,
            soldQty: 0,
            price: item.price,
            purchaseRate,
            totalSales: 0,
            totalCost: 0,
            profit: 0,
          };
        }
        salesMap[key].soldQty += qty;
        salesMap[key].totalSales += totalSales;
        salesMap[key].totalCost += totalCost;
        salesMap[key].profit += totalSales - totalCost;
      }
    }

    // Payment breakdown
    const payments = {};
    orders.forEach((o) => {
      const method = o.paymentMethod || "Other";
      payments[method] = (payments[method] || 0) + o.grandTotal;
    });

    const salesData = Object.values(salesMap);
    const totalSales = salesData.reduce((sum, s) => sum + s.totalSales, 0);
    const totalCost = salesData.reduce((sum, s) => sum + s.totalCost, 0);
    const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
    const grossProfit = totalSales - totalCost;
    const netProfit = grossProfit - totalExpenses;

    res.json({
      success: true,
      data: {
        date,
        salesData,
        expenses,
        payments,
        totalSales,
        totalCost,
        grossProfit,
        totalExpenses,
        netProfit,
        totalOrders: orders.length,
      },
    });
  })
);

// GET /api/reports/range — date range report (auth required)
router.get(
  "/range",
  verifyToken,
  asyncHandler(async (req, res) => {
    const { from, to } = req.query;
    if (!from || !to) {
      return res.status(400).json({ success: false, error: "Both 'from' and 'to' dates required" });
    }

    const [orders, expenses] = await Promise.all([
      Order.find({ date: { $gte: String(from), $lte: String(to) }, status: "completed" }),
      Expense.find({ date: { $gte: String(from), $lte: String(to) } }),
    ]);

    const totalRevenue = orders.reduce((sum, o) => sum + o.grandTotal, 0);
    const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);

    res.json({
      success: true,
      data: {
        from,
        to,
        totalOrders: orders.length,
        totalRevenue,
        totalExpenses,
        netProfit: totalRevenue - totalExpenses,
      },
    });
  })
);

// GET /api/reports/sales-summary — sales summary with optional date filter (auth required)
router.get(
  "/sales-summary",
  verifyToken,
  asyncHandler(async (req, res) => {
    const { date } = req.query;
    const filter = { status: "completed" };
    if (date) filter.date = String(date);

    const [orders, products] = await Promise.all([
      Order.find(filter).select("order createdAt"),
      Product.find({}).select("name price purchaseRate"),
    ]);

    const productMap = {};
    products.forEach((p) => {
      productMap[p.name] = { price: p.price, purchaseRate: p.purchaseRate || 0 };
    });

    const summaryMap = {};
    for (const order of orders) {
      for (const item of order.order) {
        const key = item.name;
        const product = productMap[key] || {};
        const price = product.price || item.price || 0;
        const purchaseRate = product.purchaseRate || 0;
        const qty = item.amount;
        const totalSales = price * qty;
        const totalCost = purchaseRate * qty;

        if (!summaryMap[key]) {
          summaryMap[key] = {
            name: item.name,
            soldQty: 0,
            price,
            purchaseRate,
            totalSales: 0,
            totalCost: 0,
            profit: 0,
            lastSold: order.createdAt,
          };
        }
        summaryMap[key].soldQty += qty;
        summaryMap[key].totalSales += totalSales;
        summaryMap[key].totalCost += totalCost;
        summaryMap[key].profit += totalSales - totalCost;
        summaryMap[key].lastSold = order.createdAt;
      }
    }

    const summaryList = Object.values(summaryMap).sort((a, b) => b.soldQty - a.soldQty);
    res.json({ success: true, data: summaryList });
  })
);

module.exports = router;
