const express = require("express");
const router = express.Router();
const { verifyToken } = require("../middleware/auth");
const roleCheck = require("../middleware/roleCheck");
const Product = require("../models/Product");
const StockLog = require("../models/StockLog");
const asyncHandler = require("../middleware/asyncHandler");
const { logAudit } = require("../config/audit");

// POST /adjust - Adjust product stock (admin/manager only)
router.post(
  "/adjust",
  verifyToken,
  roleCheck("admin", "manager"),
  asyncHandler(async (req, res) => {
    const { productId, quantity, type, reason } = req.body;

    if (!productId || quantity === undefined || !type) {
      return res.status(400).json({
        success: false,
        error: "Product ID, quantity, and type required",
      });
    }

    if (typeof quantity !== "number") {
      return res.status(400).json({ success: false, error: "Quantity must be a number" });
    }

    const product = await Product.findById(productId);
    if (!product) {
      return res
        .status(404)
        .json({ success: false, error: "Product not found" });
    }

    const previousStock = product.stock || 0;
    const newStock = Math.max(0, previousStock + quantity);

    // Atomic update to prevent race conditions
    await Product.findByIdAndUpdate(productId, { $set: { stock: newStock } });

    const log = await StockLog.create({
      productId,
      type,
      quantity,
      previousStock,
      newStock,
      reason: reason || "",
      userId: req.user.id,
    });

    await logAudit({ action: "stock-adjust", entity: "Product", entityId: productId, user: req.user, details: { type, quantity, previousStock, newStock } });

    const updatedProduct = await Product.findById(productId);
    res.json({
      success: true,
      data: { product: updatedProduct, log },
    });
  })
);

// GET /low - Get low stock products
router.get(
  "/low",
  verifyToken,
  asyncHandler(async (req, res) => {
    const threshold = parseInt(req.query.threshold) || 10;

    const products = await Product.find({
      stock: { $lte: threshold },
    }).sort({ stock: 1 });

    res.json({ success: true, data: products });
  })
);

// GET /log - Get stock log
router.get(
  "/log",
  verifyToken,
  asyncHandler(async (req, res) => {
    const { productId, type, limit, skip } = req.query;

    const filter = {};
    if (productId) filter.productId = productId;
    if (type) filter.type = String(type);

    const queryLimit = Math.min(parseInt(limit) || 100, 1000);
    const querySkip = parseInt(skip) || 0;

    const [logs, total] = await Promise.all([
      StockLog.find(filter)
        .populate("productId", "name")
        .populate("userId", "username")
        .sort({ createdAt: -1 })
        .limit(queryLimit)
        .skip(querySkip),
      StockLog.countDocuments(filter),
    ]);

    res.json({ success: true, data: logs, total });
  })
);

// GET /summary - Get stock summary
router.get(
  "/summary",
  verifyToken,
  asyncHandler(async (req, res) => {
    const summary = await Product.aggregate([
      {
        $group: {
          _id: null,
          totalProducts: { $sum: 1 },
          totalStock: { $sum: { $ifNull: ["$stock", 0] } },
          lowStockCount: {
            $sum: {
              $cond: [
                { $and: [{ $gt: [{ $ifNull: ["$stock", 0] }, 0] }, { $lte: [{ $ifNull: ["$stock", 0] }, 10] }] },
                1,
                0,
              ],
            },
          },
          outOfStock: {
            $sum: {
              $cond: [{ $lte: [{ $ifNull: ["$stock", 0] }, 0] }, 1, 0],
            },
          },
        },
      },
    ]);

    res.json({
      success: true,
      data: summary[0] || {
        totalProducts: 0,
        totalStock: 0,
        lowStockCount: 0,
        outOfStock: 0,
      },
    });
  })
);

module.exports = router;
