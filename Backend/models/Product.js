const mongoose = require("mongoose");

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    price: { type: Number, required: true, min: 0 },
    mrp: { type: Number, default: 0, min: 0 },
    purchaseRate: { type: Number, default: 0, min: 0 },
    type: { type: Number, required: true },
    description: { type: String, default: "" },
    imageUrl: { type: String, default: "" },
    favorite: { type: Boolean, default: false },
    isAvailable: { type: Boolean, default: true },
    stock: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true }
);

// Indexes for query performance
productSchema.index({ type: 1 });
productSchema.index({ isAvailable: 1 });
productSchema.index({ stock: 1 });

module.exports = mongoose.model("Product", productSchema);
