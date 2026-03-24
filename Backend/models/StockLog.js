const mongoose = require("mongoose");

const stockLogSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    type: {
      type: String,
      enum: ["sale", "purchase", "wastage", "adjustment", "return"],
      required: true,
    },
    quantity: { type: Number },
    previousStock: { type: Number },
    newStock: { type: Number },
    reason: { type: String, default: "" },
    reference: { type: String, default: "" },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "Admin" },
  },
  { timestamps: true }
);

stockLogSchema.index({ productId: 1, createdAt: -1 });
stockLogSchema.index({ type: 1 });

module.exports = mongoose.model("StockLog", stockLogSchema);
