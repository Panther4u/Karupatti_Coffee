const express = require("express");
const router = express.Router();
const Voucher = require("../models/Voucher");
const { verifyToken } = require("../middleware/auth");
const asyncHandler = require("../middleware/asyncHandler");
const { logAudit } = require("../config/audit");

// POST /api/vouchers/validate — validate a voucher code (no auth, does NOT consume usage)
router.post(
  "/validate",
  asyncHandler(async (req, res) => {
    const { code, orderAmount } = req.body;
    if (!code) return res.status(400).json({ success: false, error: "Voucher code required" });

    const voucher = await Voucher.findOne({ code: code.toUpperCase(), isActive: true });
    if (!voucher) return res.status(404).json({ success: false, error: "Invalid or expired voucher code" });

    // Check expiry
    if (voucher.expiresAt && new Date() > voucher.expiresAt) {
      return res.status(400).json({ success: false, error: "Voucher has expired" });
    }

    // Check usage limit
    if (voucher.usageLimit && voucher.usedCount >= voucher.usageLimit) {
      return res.status(400).json({ success: false, error: "Voucher usage limit reached" });
    }

    // Check minimum order
    if (orderAmount && orderAmount < voucher.minOrderAmount) {
      return res.status(400).json({
        success: false,
        error: `Minimum order amount is ₹${voucher.minOrderAmount}`,
      });
    }

    // Calculate discount (do NOT increment usedCount here — only on order placement)
    let discount = 0;
    if (voucher.discountType === "percentage") {
      discount = ((orderAmount || 0) * voucher.discountValue) / 100;
      if (voucher.maxDiscount) discount = Math.min(discount, voucher.maxDiscount);
    } else {
      discount = voucher.discountValue;
    }

    res.json({
      success: true,
      data: {
        valid: true,
        code: voucher.code,
        discountType: voucher.discountType,
        discountValue: voucher.discountValue,
        discount: Math.round(discount * 100) / 100,
      },
    });
  })
);

// POST /api/vouchers/redeem — atomically redeem voucher (called when order is placed)
router.post(
  "/redeem",
  asyncHandler(async (req, res) => {
    const { code } = req.body;
    if (!code) return res.status(400).json({ success: false, error: "Voucher code required" });

    // Atomically increment usedCount only if under the limit
    const voucher = await Voucher.findOneAndUpdate(
      {
        code: code.toUpperCase(),
        isActive: true,
        $or: [
          { usageLimit: null },
          { $expr: { $lt: ["$usedCount", "$usageLimit"] } },
        ],
      },
      { $inc: { usedCount: 1 } },
      { new: true }
    );

    if (!voucher) {
      return res.status(400).json({ success: false, error: "Voucher cannot be redeemed" });
    }

    res.json({ success: true, data: { code: voucher.code, usedCount: voucher.usedCount } });
  })
);

// GET /api/vouchers — list all vouchers (auth required)
router.get(
  "/",
  verifyToken,
  asyncHandler(async (req, res) => {
    const vouchers = await Voucher.find().sort({ createdAt: -1 });
    res.json({ success: true, data: vouchers });
  })
);

// POST /api/vouchers — create voucher (auth required)
router.post(
  "/",
  verifyToken,
  asyncHandler(async (req, res) => {
    const { code, discountType, discountValue, minOrderAmount, maxDiscount, usageLimit, expiresAt } = req.body;
    if (!code || !discountValue || discountValue <= 0) {
      return res.status(400).json({ success: false, error: "Code and positive discount value required" });
    }

    const exists = await Voucher.findOne({ code: code.toUpperCase() });
    if (exists) return res.status(400).json({ success: false, error: "Voucher code already exists" });

    const voucher = await Voucher.create({
      code, discountType, discountValue, minOrderAmount, maxDiscount, usageLimit, expiresAt,
    });

    await logAudit({ action: "create", entity: "Voucher", entityId: voucher._id, user: req.user, details: { code } });

    res.status(201).json({ success: true, data: voucher });
  })
);

// PUT /api/vouchers/:id — update voucher (auth required, whitelist fields)
router.put(
  "/:id",
  verifyToken,
  asyncHandler(async (req, res) => {
    const { code, discountType, discountValue, minOrderAmount, maxDiscount, usageLimit, expiresAt, isActive } = req.body;
    const update = {};
    if (code !== undefined) update.code = code;
    if (discountType !== undefined) update.discountType = discountType;
    if (discountValue !== undefined) update.discountValue = discountValue;
    if (minOrderAmount !== undefined) update.minOrderAmount = minOrderAmount;
    if (maxDiscount !== undefined) update.maxDiscount = maxDiscount;
    if (usageLimit !== undefined) update.usageLimit = usageLimit;
    if (expiresAt !== undefined) update.expiresAt = expiresAt;
    if (isActive !== undefined) update.isActive = isActive;

    const voucher = await Voucher.findByIdAndUpdate(req.params.id, update, { new: true, runValidators: true });
    if (!voucher) return res.status(404).json({ success: false, error: "Voucher not found" });

    await logAudit({ action: "update", entity: "Voucher", entityId: voucher._id, user: req.user });

    res.json({ success: true, data: voucher });
  })
);

// DELETE /api/vouchers/:id — delete voucher (auth required)
router.delete(
  "/:id",
  verifyToken,
  asyncHandler(async (req, res) => {
    const voucher = await Voucher.findByIdAndDelete(req.params.id);
    if (!voucher) return res.status(404).json({ success: false, error: "Voucher not found" });

    await logAudit({ action: "delete", entity: "Voucher", entityId: req.params.id, user: req.user });

    res.json({ success: true, message: "Voucher deleted" });
  })
);

module.exports = router;
