const express = require("express");
const router = express.Router();
const Order = require("../models/Order");
const { verifyToken } = require("../middleware/auth");
const roleCheck = require("../middleware/roleCheck");
const asyncHandler = require("../middleware/asyncHandler");
const { getIO } = require("../config/socket");
const { logAudit } = require("../config/audit");

/**
 * Safely emit a socket event — swallows errors if Socket.io
 * is not yet initialized (e.g. during tests).
 */
function emitEvent(event, data) {
  try {
    getIO().emit(event, data);
  } catch {
    // Socket.io not ready — skip silently
  }
}

// POST /api/orders — create order (auth required)
router.post(
  "/",
  verifyToken,
  asyncHandler(async (req, res) => {
    const { order, total, discount, grandTotal, paymentMethod, tableNo } = req.body;

    if (!order || !Array.isArray(order) || order.length === 0) {
      return res.status(400).json({ success: false, error: "Order items required" });
    }
    if (!paymentMethod) {
      return res.status(400).json({ success: false, error: "Payment method required" });
    }
    if (typeof grandTotal !== "number" || grandTotal < 0) {
      return res.status(400).json({ success: false, error: "Valid grandTotal required" });
    }

    const now = new Date();
    const ist = new Date(now.getTime() + (5.5 * 60 * 60 * 1000));
    const newOrder = await Order.create({
      order,
      total: total || grandTotal,
      discount: discount || 0,
      grandTotal,
      paymentMethod,
      tableNo: tableNo || "01",
      date: ist.toISOString().split("T")[0],
      time: now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true, timeZone: "Asia/Kolkata" }),
      createdBy: {
        username: req.user?.username || "",
        role: req.user?.role || "",
      },
    });

    emitEvent("new-order", {
      id: newOrder._id,
      billNo: newOrder.billNo,
      orderNumber: newOrder.orderNumber,
      grandTotal: newOrder.grandTotal,
      paymentMethod: newOrder.paymentMethod,
      order: newOrder.order,
      date: newOrder.date,
      time: newOrder.time,
      status: newOrder.status,
      createdBy: newOrder.createdBy,
      createdAt: newOrder.createdAt,
    });

    await logAudit({ action: "create", entity: "Order", entityId: newOrder._id, user: req.user, details: { grandTotal: newOrder.grandTotal, orderNumber: newOrder.orderNumber } });

    res.status(201).json({
      success: true,
      data: {
        id: newOrder._id,
        billNo: newOrder.billNo,
        orderNumber: newOrder.orderNumber,
      },
    });
  })
);

// GET /api/orders — list orders (auth required)
// Non-admin users see only their own orders; admin/manager see all
router.get(
  "/",
  verifyToken,
  asyncHandler(async (req, res) => {
    const { date, status, page = 1, limit = 50 } = req.query;
    const filter = {};
    if (date) filter.date = String(date);
    if (status) filter.status = String(status);

    // Non-admin/manager users only see their own orders
    const role = req.user?.role;
    if (role !== "admin" && role !== "manager") {
      filter["createdBy.username"] = req.user?.username || "";
    }

    const pageNum = Math.max(1, Number(page));
    const limitNum = Math.min(Math.max(1, Number(limit)), 500);

    const [orders, total] = await Promise.all([
      Order.find(filter).sort({ createdAt: -1 }).skip((pageNum - 1) * limitNum).limit(limitNum),
      Order.countDocuments(filter),
    ]);

    res.json({ success: true, data: { orders, total, page: pageNum, pages: Math.ceil(total / limitNum) } });
  })
);

// GET /api/orders/today — today's orders summary (auth required)
router.get(
  "/today",
  verifyToken,
  asyncHandler(async (req, res) => {
    const now = new Date();
    const ist = new Date(now.getTime() + (5.5 * 60 * 60 * 1000));
    const today = ist.toISOString().split("T")[0];
    const orders = await Order.find({ date: today, status: "completed" });

    const totalRevenue = orders.reduce((sum, o) => sum + o.grandTotal, 0);
    const totalOrders = orders.length;
    const totalItems = orders.reduce(
      (sum, o) => sum + o.order.reduce((s, i) => s + i.amount, 0),
      0
    );

    res.json({ success: true, data: { date: today, totalOrders, totalRevenue, totalItems, orders } });
  })
);

// GET /api/orders/:id — get order by ID or order number (auth required)
router.get(
  "/:id",
  verifyToken,
  asyncHandler(async (req, res) => {
    let order;
    if (req.params.id.startsWith("#")) {
      order = await Order.findOne({ orderNumber: req.params.id });
    } else {
      order = await Order.findById(req.params.id);
    }
    if (!order) return res.status(404).json({ success: false, error: "Order not found" });
    res.json({ success: true, data: order });
  })
);

// PATCH /api/orders/:id/cancel — cancel order (auth required)
router.patch(
  "/:id/cancel",
  verifyToken,
  asyncHandler(async (req, res) => {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ success: false, error: "Order not found" });
    if (order.status === "cancelled") {
      return res.status(400).json({ success: false, error: "Order already cancelled" });
    }
    order.status = "cancelled";
    await order.save();

    emitEvent("order-cancelled", {
      id: order._id,
      billNo: order.billNo,
      orderNumber: order.orderNumber,
      status: "cancelled",
    });

    await logAudit({ action: "cancel", entity: "Order", entityId: order._id, user: req.user });

    res.json({ success: true, data: order });
  })
);

// PATCH /api/orders/:id/receipt — mark receipt as printed (auth required)
router.patch(
  "/:id/receipt",
  verifyToken,
  asyncHandler(async (req, res) => {
    const order = await Order.findByIdAndUpdate(
      req.params.id,
      { receiptPrinted: true },
      { new: true }
    );
    if (!order) return res.status(404).json({ success: false, error: "Order not found" });
    res.json({ success: true, data: order });
  })
);

// PUT /api/orders/:id — update order (admin/manager only, whitelist fields)
router.put(
  "/:id",
  verifyToken,
  roleCheck("admin", "manager"),
  asyncHandler(async (req, res) => {
    const { order: items, total, discount, grandTotal, paymentMethod, tableNo, status } = req.body;
    const update = {};
    if (items !== undefined) update.order = items;
    if (total !== undefined) update.total = total;
    if (discount !== undefined) update.discount = discount;
    if (grandTotal !== undefined) update.grandTotal = grandTotal;
    if (paymentMethod !== undefined) update.paymentMethod = paymentMethod;
    if (tableNo !== undefined) update.tableNo = tableNo;
    if (status !== undefined) update.status = status;

    const updatedOrder = await Order.findByIdAndUpdate(req.params.id, update, { new: true, runValidators: true });
    if (!updatedOrder) return res.status(404).json({ success: false, error: "Order not found" });

    await logAudit({ action: "update", entity: "Order", entityId: updatedOrder._id, user: req.user });

    res.json({ success: true, data: updatedOrder });
  })
);

// DELETE /api/orders/:id — delete order (admin/manager only)
router.delete(
  "/:id",
  verifyToken,
  roleCheck("admin", "manager"),
  asyncHandler(async (req, res) => {
    const order = await Order.findByIdAndDelete(req.params.id);
    if (!order) return res.status(404).json({ success: false, error: "Order not found" });

    emitEvent("order-deleted", {
      id: order._id,
      billNo: order.billNo,
      orderNumber: order.orderNumber,
    });

    await logAudit({ action: "delete", entity: "Order", entityId: order._id, user: req.user });

    res.json({ success: true, message: "Order deleted" });
  })
);

module.exports = router;
