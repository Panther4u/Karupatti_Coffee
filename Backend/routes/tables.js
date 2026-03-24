const express = require("express");
const router = express.Router();
const { verifyToken } = require("../middleware/auth");
const Table = require("../models/Table");
const asyncHandler = require("../middleware/asyncHandler");

// GET / - Get all tables
router.get(
  "/",
  verifyToken,
  asyncHandler(async (req, res) => {
    const tables = await Table.find()
      .populate("currentOrderId")
      .sort({ tableNumber: 1 });
    res.json({ success: true, data: tables });
  })
);

// POST / - Create a new table
router.post(
  "/",
  verifyToken,
  asyncHandler(async (req, res) => {
    const { tableNumber, capacity, section, position } = req.body;

    if (!tableNumber) {
      return res
        .status(400)
        .json({ success: false, error: "Table number required" });
    }

    const existingTable = await Table.findOne({ tableNumber });
    if (existingTable) {
      return res.status(409).json({
        success: false,
        error: "Table number already exists",
      });
    }

    const table = new Table({
      tableNumber,
      capacity: capacity || 4,
      section: section || "indoor",
      position: position || { x: 0, y: 0 },
    });

    await table.save();
    res.json({ success: true, data: table });
  })
);

// POST /setup - Setup multiple tables
router.post(
  "/setup",
  verifyToken,
  asyncHandler(async (req, res) => {
    const { tables } = req.body;

    if (!Array.isArray(tables) || tables.length === 0) {
      return res
        .status(400)
        .json({ success: false, error: "Tables array required" });
    }

    const createdTables = await Table.insertMany(tables);
    res.json({ success: true, data: createdTables });
  })
);

// PATCH /:id/assign - Assign order to table
router.patch(
  "/:id/assign",
  verifyToken,
  asyncHandler(async (req, res) => {
    const { orderId } = req.body;

    if (!orderId) {
      return res
        .status(400)
        .json({ success: false, error: "Order ID required" });
    }

    const table = await Table.findByIdAndUpdate(
      req.params.id,
      { currentOrderId: orderId, status: "occupied" },
      { new: true }
    ).populate("currentOrderId");

    if (!table) {
      return res
        .status(404)
        .json({ success: false, error: "Table not found" });
    }

    res.json({ success: true, data: table });
  })
);

// PATCH /:id/release - Release table
router.patch(
  "/:id/release",
  verifyToken,
  asyncHandler(async (req, res) => {
    const table = await Table.findByIdAndUpdate(
      req.params.id,
      { currentOrderId: null, status: "available" },
      { new: true }
    ).populate("currentOrderId");

    if (!table) {
      return res
        .status(404)
        .json({ success: false, error: "Table not found" });
    }

    res.json({ success: true, data: table });
  })
);

// DELETE /:id - Delete table
router.delete(
  "/:id",
  verifyToken,
  asyncHandler(async (req, res) => {
    const table = await Table.findByIdAndDelete(req.params.id);

    if (!table) {
      return res
        .status(404)
        .json({ success: false, error: "Table not found" });
    }

    res.json({ success: true, message: "Table deleted" });
  })
);

module.exports = router;
