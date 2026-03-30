const express = require("express");
const router = express.Router();
const Product = require("../models/Product");
const { verifyToken } = require("../middleware/auth");
const asyncHandler = require("../middleware/asyncHandler");
const { logAudit } = require("../config/audit");

// GET /api/products — list all products
// Authenticated: all fields. Unauthenticated: hide purchaseRate.
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const { category, available } = req.query;
    const filter = {};
    if (category) filter.type = Number(category);
    if (available !== undefined) filter.isAvailable = available === "true";

    // Check if authenticated (optional auth)
    let authenticated = false;
    try {
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith("Bearer ")) {
        const jwt = require("jsonwebtoken");
        jwt.verify(authHeader.split(" ")[1], process.env.JWT_SECRET);
        authenticated = true;
      }
    } catch {}

    const query = Product.find(filter).sort({ type: 1, name: 1 });
    if (!authenticated) query.select("-purchaseRate");
    const products = await query;
    res.json({ success: true, data: products });
  })
);

// GET /api/products/categories — list distinct categories
router.get(
  "/categories",
  asyncHandler(async (req, res) => {
    const categories = await Product.distinct("type");
    res.json({ success: true, data: categories.sort((a, b) => a - b) });
  })
);

// GET /api/products/:id
router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ success: false, error: "Product not found" });
    res.json({ success: true, data: product });
  })
);

// POST /api/products — add product (auth required)
router.post(
  "/",
  verifyToken,
  asyncHandler(async (req, res) => {
    const { name, price, mrp, purchaseRate, type, description, imageUrl } = req.body;
    if (!name || typeof price !== "number" || price < 0 || type === undefined) {
      return res.status(400).json({ success: false, error: "Missing required fields: name, price (>= 0), type" });
    }

    const product = await Product.create({
      name, price, mrp, purchaseRate, type, description, imageUrl,
    });

    await logAudit({ action: "create", entity: "Product", entityId: product._id, user: req.user, details: { name } });

    res.status(201).json({ success: true, data: product });
  })
);

// POST /api/products/bulk — bulk create products (auth required)
router.post(
  "/bulk",
  verifyToken,
  asyncHandler(async (req, res) => {
    const { products } = req.body;
    if (!Array.isArray(products)) {
      return res.status(400).json({ success: false, error: "Products must be an array" });
    }
    const created = await Product.insertMany(products);

    await logAudit({ action: "bulk-create", entity: "Product", user: req.user, details: { count: created.length } });

    res.status(201).json({ success: true, data: { count: created.length } });
  })
);

// PUT /api/products/:id — update product (auth required, whitelist fields)
router.put(
  "/:id",
  verifyToken,
  asyncHandler(async (req, res) => {
    const { name, price, mrp, purchaseRate, type, description, imageUrl, favorite, isAvailable, stock } = req.body;
    const update = {};
    if (name !== undefined) update.name = name;
    if (price !== undefined) update.price = price;
    if (mrp !== undefined) update.mrp = mrp;
    if (purchaseRate !== undefined) update.purchaseRate = purchaseRate;
    if (type !== undefined) update.type = type;
    if (description !== undefined) update.description = description;
    if (imageUrl !== undefined) update.imageUrl = imageUrl;
    if (favorite !== undefined) update.favorite = favorite;
    if (isAvailable !== undefined) update.isAvailable = isAvailable;
    if (stock !== undefined) update.stock = stock;

    const product = await Product.findByIdAndUpdate(req.params.id, update, { new: true, runValidators: true });
    if (!product) return res.status(404).json({ success: false, error: "Product not found" });

    await logAudit({ action: "update", entity: "Product", entityId: product._id, user: req.user });

    res.json({ success: true, data: product });
  })
);

// PATCH /api/products/:id/toggle — toggle availability (auth required)
router.patch(
  "/:id/toggle",
  verifyToken,
  asyncHandler(async (req, res) => {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ success: false, error: "Product not found" });

    product.isAvailable = !product.isAvailable;
    await product.save();
    res.json({ success: true, data: { isAvailable: product.isAvailable } });
  })
);

// DELETE /api/products/:id — delete product (auth required)
router.delete(
  "/:id",
  verifyToken,
  asyncHandler(async (req, res) => {
    const product = await Product.findByIdAndDelete(req.params.id);
    if (!product) return res.status(404).json({ success: false, error: "Product not found" });

    await logAudit({ action: "delete", entity: "Product", entityId: product._id, user: req.user, details: { name: product.name } });

    res.json({ success: true, message: "Product deleted" });
  })
);

module.exports = router;
