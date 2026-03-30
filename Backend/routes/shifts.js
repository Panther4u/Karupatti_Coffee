const express = require("express");
const router = express.Router();
const { verifyToken } = require("../middleware/auth");
const Shift = require("../models/Shift");
const asyncHandler = require("../middleware/asyncHandler");
const { logAudit } = require("../config/audit");

// POST /open - Open a new shift
router.post(
  "/open",
  verifyToken,
  asyncHandler(async (req, res) => {
    const { openingCash } = req.body;

    if (openingCash === undefined || typeof openingCash !== "number" || openingCash < 0) {
      return res
        .status(400)
        .json({ success: false, error: "Valid opening cash required" });
    }

    try {
      const result = await Shift.findOneAndUpdate(
        { status: "active" },
        {
          $setOnInsert: {
            userId: req.user.id,
            userName: req.user.username || req.user.email,
            openingCash,
            status: "active",
          },
        },
        { upsert: true, new: true, rawResult: true }
      );

      if (!result.lastErrorObject.upserted) {
        return res.status(409).json({
          success: false,
          error: "An active shift already exists",
        });
      }

      const shift = result.value;

      await logAudit({ action: "open-shift", entity: "Shift", entityId: shift._id, user: req.user });

      res.json({ success: true, data: shift });
    } catch (err) {
      if (err.code === 11000) {
        return res.status(409).json({
          success: false,
          error: "An active shift already exists",
        });
      }
      throw err;
    }
  })
);

// POST /close - Close active shift (fix: expectedCash uses only cashRevenue)
router.post(
  "/close",
  verifyToken,
  asyncHandler(async (req, res) => {
    const { closingCash, totalOrders, totalRevenue, cashRevenue, upiRevenue, cardRevenue } = req.body;

    if (closingCash === undefined || typeof closingCash !== "number") {
      return res
        .status(400)
        .json({ success: false, error: "Closing cash required" });
    }

    const shift = await Shift.findOne({ status: "active" });

    if (!shift) {
      return res
        .status(404)
        .json({ success: false, error: "No active shift found" });
    }

    shift.closingCash = closingCash;
    shift.endTime = new Date();
    shift.status = "closed";
    shift.totalOrders = totalOrders || 0;
    shift.totalRevenue = totalRevenue || 0;
    shift.cashRevenue = cashRevenue || 0;
    shift.upiRevenue = upiRevenue || 0;
    shift.cardRevenue = cardRevenue || 0;
    // Expected cash = opening cash + ONLY cash revenue (not UPI/card)
    shift.expectedCash = shift.openingCash + (cashRevenue || 0);
    shift.difference = closingCash - shift.expectedCash;

    await shift.save();

    await logAudit({ action: "close-shift", entity: "Shift", entityId: shift._id, user: req.user, details: { difference: shift.difference } });

    res.json({ success: true, data: shift });
  })
);

// GET /current - Get current active shift
router.get(
  "/current",
  verifyToken,
  asyncHandler(async (req, res) => {
    const shift = await Shift.findOne({ status: "active" });

    if (!shift) {
      return res.json({ success: true, data: null });
    }

    res.json({ success: true, data: shift });
  })
);

// GET /history - Get shift history
router.get(
  "/history",
  verifyToken,
  asyncHandler(async (req, res) => {
    const limit = Math.min(parseInt(req.query.limit) || 50, 500);
    const skip = Math.max(0, parseInt(req.query.skip) || 0);

    const [shifts, total] = await Promise.all([
      Shift.find().sort({ createdAt: -1 }).limit(limit).skip(skip),
      Shift.countDocuments(),
    ]);

    res.json({ success: true, data: shifts, total });
  })
);

module.exports = router;
