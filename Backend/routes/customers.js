const express = require("express");
const router = express.Router();
const { verifyToken } = require("../middleware/auth");
const Customer = require("../models/Customer");
const asyncHandler = require("../middleware/asyncHandler");
const { logAudit } = require("../config/audit");

// Escape special regex characters to prevent ReDoS
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// POST / - Create customer
router.post(
  "/",
  verifyToken,
  asyncHandler(async (req, res) => {
    const { name, phone, notes } = req.body;

    if (!name) {
      return res
        .status(400)
        .json({ success: false, error: "Customer name required" });
    }

    const customer = new Customer({ name, phone, notes });
    await customer.save();

    await logAudit({ action: "create", entity: "Customer", entityId: customer._id, user: req.user, details: { name } });

    res.json({ success: true, data: customer });
  })
);

// GET /search - Search customers (fix: escape regex input)
router.get(
  "/search",
  verifyToken,
  asyncHandler(async (req, res) => {
    const { query } = req.query;

    if (!query) {
      return res
        .status(400)
        .json({ success: false, error: "Search query required" });
    }

    const escapedQuery = escapeRegex(String(query));

    const customers = await Customer.find({
      $or: [
        { name: { $regex: escapedQuery, $options: "i" } },
        { phone: { $regex: escapedQuery, $options: "i" } },
      ],
    });

    res.json({ success: true, data: customers });
  })
);

// GET /:id - Get customer details
router.get(
  "/:id",
  verifyToken,
  asyncHandler(async (req, res) => {
    const customer = await Customer.findById(req.params.id);

    if (!customer) {
      return res
        .status(404)
        .json({ success: false, error: "Customer not found" });
    }

    res.json({ success: true, data: customer });
  })
);

// PUT /:id - Update customer
router.put(
  "/:id",
  verifyToken,
  asyncHandler(async (req, res) => {
    const { name, phone, notes } = req.body;

    const customer = await Customer.findByIdAndUpdate(
      req.params.id,
      { name, phone, notes },
      { new: true, runValidators: true }
    );

    if (!customer) {
      return res
        .status(404)
        .json({ success: false, error: "Customer not found" });
    }

    res.json({ success: true, data: customer });
  })
);

// PATCH /:id/visit - Record customer visit
router.patch(
  "/:id/visit",
  verifyToken,
  asyncHandler(async (req, res) => {
    const { orderAmount } = req.body;

    const customer = await Customer.findByIdAndUpdate(
      req.params.id,
      {
        lastVisit: new Date(),
        $inc: { totalOrders: 1, totalSpent: orderAmount || 0 },
      },
      { new: true }
    );

    if (!customer) {
      return res
        .status(404)
        .json({ success: false, error: "Customer not found" });
    }

    res.json({ success: true, data: customer });
  })
);

module.exports = router;
