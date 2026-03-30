const express = require("express");
const router = express.Router();
const { verifyToken } = require("../middleware/auth");
const roleCheck = require("../middleware/roleCheck");
const Purchase = require("../models/Purchase");
const Product = require("../models/Product");
const StockLog = require("../models/StockLog");
const asyncHandler = require("../middleware/asyncHandler");
const { logAudit } = require("../config/audit");

// POST / - Create purchase
router.post(
  "/",
  verifyToken,
  asyncHandler(async (req, res) => {
    const { supplier, items, invoiceNumber, paidStatus, notes } = req.body;

    if (!items || items.length === 0) {
      return res
        .status(400)
        .json({ success: false, error: "Items required" });
    }

    let grandTotal = 0;
    items.forEach((item) => {
      if (typeof item.quantity !== "number" || item.quantity <= 0) {
        throw Object.assign(new Error("Each item must have a positive quantity"), { statusCode: 400 });
      }
      if (typeof item.costPrice !== "number" || item.costPrice < 0) {
        throw Object.assign(new Error("Each item must have a valid cost price"), { statusCode: 400 });
      }
      grandTotal += item.total || item.quantity * item.costPrice;
    });

    const purchase = new Purchase({
      supplier,
      items,
      grandTotal,
      invoiceNumber,
      paidStatus: paidStatus || "paid",
      notes,
      createdBy: req.user.id,
    });

    await purchase.save();

    // Update product stock atomically and create logs
    for (const item of items) {
      const product = await Product.findById(item.productId);
      if (product) {
        const previousStock = product.stock || 0;
        const newStock = previousStock + item.quantity;
        await Product.findByIdAndUpdate(item.productId, { $set: { stock: newStock } });

        await StockLog.create({
          productId: item.productId,
          type: "purchase",
          quantity: item.quantity,
          previousStock,
          newStock,
          reason: "Purchase: " + purchase.purchaseNumber,
          reference: purchase._id.toString(),
          userId: req.user.id,
        });
      }
    }

    await purchase.populate("items.productId");

    await logAudit({ action: "create", entity: "Purchase", entityId: purchase._id, user: req.user, details: { grandTotal, purchaseNumber: purchase.purchaseNumber } });

    res.json({ success: true, data: purchase });
  })
);

// GET / - Get all purchases
router.get(
  "/",
  verifyToken,
  asyncHandler(async (req, res) => {
    const limit = Math.min(parseInt(req.query.limit) || 50, 500);
    const skip = Math.max(0, parseInt(req.query.skip) || 0);

    const [purchases, total] = await Promise.all([
      Purchase.find()
        .populate("items.productId", "name")
        .populate("createdBy", "username")
        .sort({ createdAt: -1 })
        .limit(limit)
        .skip(skip),
      Purchase.countDocuments(),
    ]);

    res.json({ success: true, data: purchases, total });
  })
);

// GET /:id - Get purchase details
router.get(
  "/:id",
  verifyToken,
  asyncHandler(async (req, res) => {
    const purchase = await Purchase.findById(req.params.id)
      .populate("items.productId")
      .populate("createdBy", "username");

    if (!purchase) {
      return res
        .status(404)
        .json({ success: false, error: "Purchase not found" });
    }

    res.json({ success: true, data: purchase });
  })
);

// PUT /:id - Update purchase (only metadata, not items)
router.put(
  "/:id",
  verifyToken,
  asyncHandler(async (req, res) => {
    const { supplier, invoiceNumber, paidStatus, notes } = req.body;

    const purchase = await Purchase.findByIdAndUpdate(
      req.params.id,
      { supplier, invoiceNumber, paidStatus, notes },
      { new: true, runValidators: true }
    )
      .populate("items.productId")
      .populate("createdBy", "username");

    if (!purchase) {
      return res
        .status(404)
        .json({ success: false, error: "Purchase not found" });
    }

    await logAudit({ action: "update", entity: "Purchase", entityId: purchase._id, user: req.user });

    res.json({ success: true, data: purchase });
  })
);

// DELETE /:id - Delete purchase (admin/manager only, reverse stock adjustment)
router.delete(
  "/:id",
  verifyToken,
  roleCheck("admin", "manager"),
  asyncHandler(async (req, res) => {
    const purchase = await Purchase.findById(req.params.id);

    if (!purchase) {
      return res
        .status(404)
        .json({ success: false, error: "Purchase not found" });
    }

    // Reverse stock adjustments FIRST (before deleting purchase)
    for (const item of purchase.items) {
      const product = await Product.findById(item.productId);
      if (product) {
        const previousStock = product.stock || 0;
        const newStock = Math.max(0, previousStock - item.quantity);
        await Product.findByIdAndUpdate(item.productId, { $set: { stock: newStock } });

        await StockLog.create({
          productId: item.productId,
          type: "adjustment",
          quantity: -item.quantity,
          previousStock,
          newStock,
          reason: "Purchase deleted: " + purchase.purchaseNumber,
          userId: req.user.id,
        });
      }
    }

    // Now safe to delete the purchase
    await Purchase.findByIdAndDelete(req.params.id);

    await logAudit({ action: "delete", entity: "Purchase", entityId: req.params.id, user: req.user });

    res.json({ success: true, message: "Purchase deleted" });
  })
);

module.exports = router;
