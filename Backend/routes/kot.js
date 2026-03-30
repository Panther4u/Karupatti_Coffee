const express = require("express");
const router = express.Router();
const { verifyToken } = require("../middleware/auth");
const KOT = require("../models/KOT");
const asyncHandler = require("../middleware/asyncHandler");
const { logAudit } = require("../config/audit");

// POST / - Create new KOT
router.post(
  "/",
  verifyToken,
  asyncHandler(async (req, res) => {
    const { orderId, items, tableNo, kotType } = req.body;

    if (!items || items.length === 0) {
      return res
        .status(400)
        .json({ success: false, error: "Items required" });
    }

    const kot = new KOT({
      orderId,
      items,
      tableNo: tableNo || "01",
      kotType: kotType || "new",
    });

    await kot.save();

    await logAudit({ action: "create", entity: "KOT", entityId: kot._id, user: req.user, details: { kotNumber: kot.kotNumber } });

    res.json({ success: true, data: kot });
  })
);

// GET /active - Get all active KOTs
router.get(
  "/active",
  verifyToken,
  asyncHandler(async (req, res) => {
    const kots = await KOT.find({ status: { $in: ["pending", "in-progress"] } })
      .populate("orderId")
      .sort({ createdAt: -1 });
    res.json({ success: true, data: kots });
  })
);

// PATCH /:id/status - Update KOT status (fixed: use _id now that items have _id: true)
router.patch(
  "/:id/status",
  verifyToken,
  asyncHandler(async (req, res) => {
    const { status, itemStatuses } = req.body;

    if (!status) {
      return res
        .status(400)
        .json({ success: false, error: "Status required" });
    }

    const kot = await KOT.findById(req.params.id);
    if (!kot) {
      return res
        .status(404)
        .json({ success: false, error: "KOT not found" });
    }

    // Update item statuses if provided (items now have _id)
    if (itemStatuses && Array.isArray(itemStatuses)) {
      itemStatuses.forEach((itemStatus) => {
        const item = kot.items.find((i) => i._id.toString() === itemStatus.id);
        if (item) item.status = itemStatus.status;
      });
    }

    kot.status = status;
    if (status === "completed") {
      kot.completedAt = new Date();
    }

    await kot.save();

    await logAudit({ action: "update-status", entity: "KOT", entityId: kot._id, user: req.user, details: { status } });

    res.json({ success: true, data: kot });
  })
);

// GET /history - Get KOT history
router.get(
  "/history",
  verifyToken,
  asyncHandler(async (req, res) => {
    const limit = Math.min(parseInt(req.query.limit) || 100, 1000);
    const skip = Math.max(0, parseInt(req.query.skip) || 0);

    const [kots, total] = await Promise.all([
      KOT.find().populate("orderId").sort({ createdAt: -1 }).limit(limit).skip(skip),
      KOT.countDocuments(),
    ]);

    res.json({ success: true, data: kots, total });
  })
);

module.exports = router;
