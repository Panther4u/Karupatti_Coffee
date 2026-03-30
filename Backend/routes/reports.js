const express = require("express");
const router = express.Router();
const Order = require("../models/Order");
const Expense = require("../models/Expense");
const Product = require("../models/Product");
const Customer = require("../models/Customer");
const { verifyToken } = require("../middleware/auth");
const asyncHandler = require("../middleware/asyncHandler");

function getISTDate(date) {
  if (date) return date; // If explicitly provided, use as-is
  const now = new Date();
  const ist = new Date(now.getTime() + (5.5 * 60 * 60 * 1000));
  return ist.toISOString().split("T")[0];
}

// GET /api/reports/daily — daily report (auth required)
router.get(
  "/daily",
  verifyToken,
  asyncHandler(async (req, res) => {
    const date = getISTDate(req.query.date);

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
    const totalExpensesOut = expenses.filter(e => e.type === "out").reduce((sum, e) => sum + e.amount, 0);
    const totalExpensesIn = expenses.filter(e => e.type === "in").reduce((sum, e) => sum + e.amount, 0);
    const netExpenses = totalExpensesOut - totalExpensesIn;
    const grossProfit = totalSales - totalCost;
    const netProfit = grossProfit - netExpenses;

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
        totalExpensesOut,
        totalExpensesIn,
        netExpenses,
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

    const [orders, expenses, products] = await Promise.all([
      Order.find({ date: { $gte: String(from), $lte: String(to) }, status: "completed" }),
      Expense.find({ date: { $gte: String(from), $lte: String(to) } }),
      Product.find({}).select("_id purchaseRate"),
    ]);

    // Build product lookup for COGS
    const productMap = {};
    products.forEach((p) => {
      productMap[p._id.toString()] = { purchaseRate: p.purchaseRate || 0 };
    });

    // Calculate COGS
    let totalCost = 0;
    for (const order of orders) {
      for (const item of order.order) {
        const purchaseRate = item.productId
          ? productMap[item.productId.toString()]?.purchaseRate || 0
          : 0;
        totalCost += purchaseRate * item.amount;
      }
    }

    const totalRevenue = orders.reduce((sum, o) => sum + o.grandTotal, 0);
    const totalExpensesOut = expenses.filter(e => e.type === "out").reduce((sum, e) => sum + e.amount, 0);
    const totalExpensesIn = expenses.filter(e => e.type === "in").reduce((sum, e) => sum + e.amount, 0);
    const netExpenses = totalExpensesOut - totalExpensesIn;
    const grossProfit = totalRevenue - totalCost;
    const netProfit = grossProfit - netExpenses;

    res.json({
      success: true,
      data: {
        from,
        to,
        totalOrders: orders.length,
        totalRevenue,
        totalCost,
        grossProfit,
        totalExpensesOut,
        totalExpensesIn,
        netExpenses,
        netProfit,
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
      Product.find({}).select("_id price purchaseRate"),
    ]);

    const productMap = {};
    products.forEach((p) => {
      productMap[p._id.toString()] = { price: p.price, purchaseRate: p.purchaseRate || 0 };
    });

    const summaryMap = {};
    for (const order of orders) {
      for (const item of order.order) {
        const key = item.name;
        const product = item.productId ? productMap[item.productId.toString()] || {} : {};
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

// GET /api/reports/hourly — hourly breakdown of orders for a given date
router.get(
  "/hourly",
  verifyToken,
  asyncHandler(async (req, res) => {
    const date = getISTDate(req.query.date);

    const hourly = await Order.aggregate([
      { $match: { date, status: "completed" } },
      {
        $group: {
          _id: { $hour: { date: "$createdAt", timezone: "Asia/Kolkata" } },
          totalOrders: { $sum: 1 },
          totalRevenue: { $sum: "$grandTotal" },
          totalItems: { $sum: { $sum: "$order.amount" } },
        },
      },
      { $sort: { _id: 1 } },
      {
        $project: {
          _id: 0,
          hour: "$_id",
          totalOrders: 1,
          totalRevenue: 1,
          totalItems: 1,
        },
      },
    ]);

    res.json({ success: true, data: { date, hourly } });
  })
);

// GET /api/reports/category-wise — sales grouped by product type/category
router.get(
  "/category-wise",
  verifyToken,
  asyncHandler(async (req, res) => {
    const { startDate, endDate } = req.query;
    if (!startDate || !endDate) {
      return res.status(400).json({ success: false, error: "startDate and endDate required" });
    }

    const orders = await Order.find({
      date: { $gte: String(startDate), $lte: String(endDate) },
      status: "completed",
    }).select("order");

    const products = await Product.find({}).select("_id type name");
    const productMap = {};
    products.forEach((p) => {
      productMap[p._id.toString()] = { type: p.type, name: p.name };
    });

    const categoryMap = {};
    for (const order of orders) {
      for (const item of order.order) {
        const prod = item.productId ? productMap[item.productId.toString()] : null;
        const category = prod ? prod.type : 0;
        if (!categoryMap[category]) {
          categoryMap[category] = { category, totalQty: 0, totalRevenue: 0, productCount: 0 };
        }
        categoryMap[category].totalQty += item.amount;
        categoryMap[category].totalRevenue += item.price * item.amount;
        categoryMap[category].productCount += 1;
      }
    }

    const categories = Object.values(categoryMap).sort((a, b) => b.totalRevenue - a.totalRevenue);
    res.json({ success: true, data: { startDate, endDate, categories } });
  })
);

// GET /api/reports/product-performance — top products by qty or revenue
router.get(
  "/product-performance",
  verifyToken,
  asyncHandler(async (req, res) => {
    const { startDate, endDate, sort = "qty", limit = 10 } = req.query;
    if (!startDate || !endDate) {
      return res.status(400).json({ success: false, error: "startDate and endDate required" });
    }

    const limitNum = Math.min(Math.max(1, Number(limit)), 100);
    const sortField = sort === "revenue" ? "totalRevenue" : "totalQty";

    const orders = await Order.find({
      date: { $gte: String(startDate), $lte: String(endDate) },
      status: "completed",
    }).select("order");

    const productMap = {};
    for (const order of orders) {
      for (const item of order.order) {
        const key = item.productId ? item.productId.toString() : item.name;
        if (!productMap[key]) {
          productMap[key] = { name: item.name, totalQty: 0, totalRevenue: 0 };
        }
        productMap[key].totalQty += item.amount;
        productMap[key].totalRevenue += item.price * item.amount;
      }
    }

    const products = Object.values(productMap)
      .sort((a, b) => b[sortField] - a[sortField])
      .slice(0, limitNum);

    res.json({ success: true, data: { startDate, endDate, sort: sortField, products } });
  })
);

// GET /api/reports/payment-breakdown — totals grouped by paymentMethod
router.get(
  "/payment-breakdown",
  verifyToken,
  asyncHandler(async (req, res) => {
    const { startDate, endDate } = req.query;
    if (!startDate || !endDate) {
      return res.status(400).json({ success: false, error: "startDate and endDate required" });
    }

    const breakdown = await Order.aggregate([
      {
        $match: {
          date: { $gte: String(startDate), $lte: String(endDate) },
          status: "completed",
        },
      },
      {
        $group: {
          _id: "$paymentMethod",
          totalOrders: { $sum: 1 },
          totalAmount: { $sum: "$grandTotal" },
        },
      },
      {
        $project: {
          _id: 0,
          paymentMethod: "$_id",
          totalOrders: 1,
          totalAmount: 1,
        },
      },
      { $sort: { totalAmount: -1 } },
    ]);

    res.json({ success: true, data: { startDate, endDate, breakdown } });
  })
);

// GET /api/reports/expense-summary — expenses grouped by category with in/out totals
router.get(
  "/expense-summary",
  verifyToken,
  asyncHandler(async (req, res) => {
    const { startDate, endDate } = req.query;
    if (!startDate || !endDate) {
      return res.status(400).json({ success: false, error: "startDate and endDate required" });
    }

    const summary = await Expense.aggregate([
      {
        $match: {
          date: { $gte: String(startDate), $lte: String(endDate) },
        },
      },
      {
        $group: {
          _id: { category: "$category", type: "$type" },
          totalAmount: { $sum: "$amount" },
          count: { $sum: 1 },
        },
      },
      {
        $group: {
          _id: "$_id.category",
          types: {
            $push: {
              type: "$_id.type",
              totalAmount: "$totalAmount",
              count: "$count",
            },
          },
          totalAmount: { $sum: "$totalAmount" },
        },
      },
      {
        $project: {
          _id: 0,
          category: "$_id",
          types: 1,
          totalAmount: 1,
        },
      },
      { $sort: { totalAmount: -1 } },
    ]);

    const totalIn = summary.reduce((sum, s) => {
      const inType = s.types.find(t => t.type === "in");
      return sum + (inType ? inType.totalAmount : 0);
    }, 0);
    const totalOut = summary.reduce((sum, s) => {
      const outType = s.types.find(t => t.type === "out");
      return sum + (outType ? outType.totalAmount : 0);
    }, 0);

    res.json({
      success: true,
      data: { startDate, endDate, summary, totalIn, totalOut, net: totalOut - totalIn },
    });
  })
);

// GET /api/reports/customer-stats — customer order counts and spending
router.get(
  "/customer-stats",
  verifyToken,
  asyncHandler(async (req, res) => {
    const { startDate, endDate } = req.query;
    if (!startDate || !endDate) {
      return res.status(400).json({ success: false, error: "startDate and endDate required" });
    }

    const customers = await Customer.find({
      lastVisit: {
        $gte: new Date(startDate),
        $lte: new Date(endDate + "T23:59:59.999Z"),
      },
    })
      .select("name phone totalOrders totalSpent lastVisit")
      .sort({ totalSpent: -1 });

    const totalCustomers = customers.length;
    const totalSpent = customers.reduce((sum, c) => sum + c.totalSpent, 0);
    const totalOrders = customers.reduce((sum, c) => sum + c.totalOrders, 0);

    res.json({
      success: true,
      data: {
        startDate,
        endDate,
        totalCustomers,
        totalOrders,
        totalSpent,
        customers,
      },
    });
  })
);

// GET /api/reports/comparative — compare current vs previous period
router.get(
  "/comparative",
  verifyToken,
  asyncHandler(async (req, res) => {
    const { type = "daily" } = req.query;
    const now = new Date();
    const ist = new Date(now.getTime() + (5.5 * 60 * 60 * 1000));
    const today = ist.toISOString().split("T")[0];

    let currentStart, currentEnd, previousStart, previousEnd, label;

    if (type === "daily") {
      currentStart = today;
      currentEnd = today;
      // Yesterday
      const yesterday = new Date(ist);
      yesterday.setDate(yesterday.getDate() - 1);
      previousStart = yesterday.toISOString().split("T")[0];
      previousEnd = previousStart;
      label = "Today vs Yesterday";
    } else if (type === "weekly") {
      const dayOfWeek = ist.getDay(); // 0=Sun
      const startOfWeek = new Date(ist);
      startOfWeek.setDate(ist.getDate() - dayOfWeek);
      currentStart = startOfWeek.toISOString().split("T")[0];
      currentEnd = today;
      const startOfLastWeek = new Date(startOfWeek);
      startOfLastWeek.setDate(startOfLastWeek.getDate() - 7);
      const endOfLastWeek = new Date(startOfWeek);
      endOfLastWeek.setDate(endOfLastWeek.getDate() - 1);
      previousStart = startOfLastWeek.toISOString().split("T")[0];
      previousEnd = endOfLastWeek.toISOString().split("T")[0];
      label = "This Week vs Last Week";
    } else if (type === "monthly") {
      const year = ist.getFullYear();
      const month = ist.getMonth(); // 0-indexed
      currentStart = `${year}-${String(month + 1).padStart(2, "0")}-01`;
      currentEnd = today;
      const prevMonth = month === 0 ? 11 : month - 1;
      const prevYear = month === 0 ? year - 1 : year;
      const lastDayPrev = new Date(prevYear, prevMonth + 1, 0).getDate();
      previousStart = `${prevYear}-${String(prevMonth + 1).padStart(2, "0")}-01`;
      previousEnd = `${prevYear}-${String(prevMonth + 1).padStart(2, "0")}-${String(lastDayPrev).padStart(2, "0")}`;
      label = "This Month vs Last Month";
    } else {
      return res.status(400).json({ success: false, error: "type must be daily, weekly, or monthly" });
    }

    const [currentOrders, previousOrders] = await Promise.all([
      Order.find({
        date: { $gte: currentStart, $lte: currentEnd },
        status: "completed",
      }),
      Order.find({
        date: { $gte: previousStart, $lte: previousEnd },
        status: "completed",
      }),
    ]);

    const summarize = (orders) => ({
      totalOrders: orders.length,
      totalRevenue: orders.reduce((sum, o) => sum + o.grandTotal, 0),
      totalItems: orders.reduce(
        (sum, o) => sum + o.order.reduce((s, i) => s + i.amount, 0),
        0
      ),
    });

    const current = summarize(currentOrders);
    const previous = summarize(previousOrders);

    const revenueChange =
      previous.totalRevenue > 0
        ? (((current.totalRevenue - previous.totalRevenue) / previous.totalRevenue) * 100).toFixed(1)
        : null;
    const ordersChange =
      previous.totalOrders > 0
        ? (((current.totalOrders - previous.totalOrders) / previous.totalOrders) * 100).toFixed(1)
        : null;

    res.json({
      success: true,
      data: {
        type,
        label,
        current: { ...current, from: currentStart, to: currentEnd },
        previous: { ...previous, from: previousStart, to: previousEnd },
        revenueChangePercent: revenueChange ? Number(revenueChange) : null,
        ordersChangePercent: ordersChange ? Number(ordersChange) : null,
      },
    });
  })
);

module.exports = router;
