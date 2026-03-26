const mongoose = require("mongoose");
require("./Counter"); // Ensure Counter model is registered for pre-save hook

const orderItemSchema = new mongoose.Schema(
  {
    productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
    name: { type: String, required: true },
    price: { type: Number, required: true, min: 0 },
    amount: { type: Number, required: true, min: 1 },
    notes: { type: String, default: "" },
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    orderNumber: { type: String, unique: true },
    billNo: { type: String },
    order: [orderItemSchema],
    total: { type: Number, required: true, min: 0 },
    discount: { type: Number, default: 0, min: 0 },
    grandTotal: { type: Number, required: true, min: 0 },
    paymentMethod: { type: String, required: true },
    tableNo: { type: String, default: "01" },
    date: { type: String },
    time: { type: String },
    status: { type: String, enum: ["completed", "cancelled"], default: "completed" },
    receiptPrinted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// Auto-generate order number using atomic Counter
orderSchema.pre("save", async function () {
  if (!this.orderNumber) {
    const Counter = mongoose.model("Counter");
    const num = await Counter.getNextNumber("order", "ORD");
    // Extract just the number portion for display, keep full format for billNo
    this.orderNumber = '#' + num.split("/").pop();
    this.billNo = num; // Keep full format like "ORD-2025-26/000001"
  }
});

// Indexes for query performance
orderSchema.index({ date: -1 });
orderSchema.index({ status: 1 });
orderSchema.index({ createdAt: -1 });

module.exports = mongoose.model("Order", orderSchema);
