const express = require("express");
const router = express.Router();
const { verifyToken } = require("../middleware/auth");
const AuditLog = require("../models/AuditLog");
const asyncHandler = require("../middleware/asyncHandler");

// GET / - Get audit logs with filters
router.get(
  "/",
  verifyToken,
  asyncHandler(async (req, res) => {
    const {
      action,
      entity,
      entityId,
      userId,
      startDate,
      endDate,
      limit,
      skip,
    } = req.query;

    const filter = {};

    if (action) filter.action = action;
    if (entity) filter.entity = entity;
    if (entityId) filter.entityId = entityId;
    if (userId) filter.userId = userId;

    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }

    const queryLimit = Math.min(parseInt(limit) || 100, 1000);
    const querySkip = parseInt(skip) || 0;

    const logs = await AuditLog.find(filter)
      .sort({ createdAt: -1 })
      .limit(queryLimit)
      .skip(querySkip)
      .populate("userId", "username email");

    const total = await AuditLog.countDocuments(filter);

    res.json({ success: true, data: logs, total });
  })
);

module.exports = router;
