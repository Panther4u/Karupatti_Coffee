const express = require("express");
const router = express.Router();
const { verifyToken } = require("../middleware/auth");
const Discount = require("../models/Discount");
const asyncHandler = require("../middleware/asyncHandler");
const { logAudit } = require("../config/audit");

// POST / - Create discount
router.post(
  "/",
  verifyToken,
  asyncHandler(async (req, res) => {
    const { name, type, value } = req.body;

    if (!name || !type) {
      return res
        .status(400)
        .json({ success: false, error: "Name and type required" });
    }

    const discount = new Discount({
      name, type, value,
      applicableProducts: req.body.applicableProducts,
      applicableCategories: req.body.applicableCategories,
      minimumOrder: req.body.minimumOrder,
      maximumDiscount: req.body.maximumDiscount,
      schedule: req.body.schedule,
      bogoConfig: req.body.bogoConfig,
      comboConfig: req.body.comboConfig,
      active: req.body.active,
      validFrom: req.body.validFrom,
      validTo: req.body.validTo,
      createdBy: req.user.id,
    });

    await discount.save();

    await logAudit({ action: "create", entity: "Discount", entityId: discount._id, user: req.user, details: { name } });

    res.json({ success: true, data: discount });
  })
);

// GET / - Get all discounts
router.get(
  "/",
  verifyToken,
  asyncHandler(async (req, res) => {
    const discounts = await Discount.find().sort({ createdAt: -1 });
    res.json({ success: true, data: discounts });
  })
);

// GET /active - Get active discounts (fix duplicate $or with $and)
router.get(
  "/active",
  verifyToken,
  asyncHandler(async (req, res) => {
    const now = new Date();
    const discounts = await Discount.find({
      active: true,
      $and: [
        { $or: [{ validFrom: { $lte: now } }, { validFrom: null }] },
        { $or: [{ validTo: { $gte: now } }, { validTo: null }] },
      ],
    }).sort({ createdAt: -1 });

    res.json({ success: true, data: discounts });
  })
);

// GET /applicable - Get applicable discounts for product or cart
router.get(
  "/applicable",
  verifyToken,
  asyncHandler(async (req, res) => {
    const { productId, cartTotal } = req.query;

    const filter = { active: true };

    if (productId) {
      filter.$or = [
        { applicableProducts: productId },
        { applicableProducts: { $size: 0 } },
      ];
    }

    if (cartTotal) {
      filter.minimumOrder = { $lte: parseFloat(cartTotal) };
    }

    const discounts = await Discount.find(filter).sort({ createdAt: -1 });
    res.json({ success: true, data: discounts });
  })
);

// PUT /:id - Update discount (whitelist fields)
router.put(
  "/:id",
  verifyToken,
  asyncHandler(async (req, res) => {
    const { name, type, value, applicableProducts, applicableCategories, minimumOrder, maximumDiscount, schedule, bogoConfig, comboConfig, active, validFrom, validTo } = req.body;
    const update = {};
    if (name !== undefined) update.name = name;
    if (type !== undefined) update.type = type;
    if (value !== undefined) update.value = value;
    if (applicableProducts !== undefined) update.applicableProducts = applicableProducts;
    if (applicableCategories !== undefined) update.applicableCategories = applicableCategories;
    if (minimumOrder !== undefined) update.minimumOrder = minimumOrder;
    if (maximumDiscount !== undefined) update.maximumDiscount = maximumDiscount;
    if (schedule !== undefined) update.schedule = schedule;
    if (bogoConfig !== undefined) update.bogoConfig = bogoConfig;
    if (comboConfig !== undefined) update.comboConfig = comboConfig;
    if (active !== undefined) update.active = active;
    if (validFrom !== undefined) update.validFrom = validFrom;
    if (validTo !== undefined) update.validTo = validTo;

    const discount = await Discount.findByIdAndUpdate(req.params.id, update, {
      new: true,
      runValidators: true,
    });

    if (!discount) {
      return res
        .status(404)
        .json({ success: false, error: "Discount not found" });
    }

    await logAudit({ action: "update", entity: "Discount", entityId: discount._id, user: req.user });

    res.json({ success: true, data: discount });
  })
);

// DELETE /:id - Delete discount
router.delete(
  "/:id",
  verifyToken,
  asyncHandler(async (req, res) => {
    const discount = await Discount.findByIdAndDelete(req.params.id);

    if (!discount) {
      return res
        .status(404)
        .json({ success: false, error: "Discount not found" });
    }

    await logAudit({ action: "delete", entity: "Discount", entityId: req.params.id, user: req.user });

    res.json({ success: true, message: "Discount deleted" });
  })
);

module.exports = router;
