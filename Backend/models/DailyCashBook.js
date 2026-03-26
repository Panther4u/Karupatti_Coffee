const mongoose = require("mongoose");

const dailyCashBookSchema = new mongoose.Schema({
  date: { type: String, required: true, unique: true },
  openingCash: { type: Number, required: true, default: 0 },
  closingCash: { type: Number, default: null },
  status: { type: String, enum: ["open", "closed"], default: "open" },
  closedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin" },
  closedAt: { type: Date },
  notes: { type: String, default: "" },
  fixedExpensesGenerated: { type: Boolean, default: false },
  // Stored on close for fast history queries
  totalCashSales: { type: Number, default: 0 },
  totalCashIn: { type: Number, default: 0 },
  totalCashOut: { type: Number, default: 0 },
  totalPurchases: { type: Number, default: 0 },
}, { timestamps: true });

dailyCashBookSchema.index({ date: -1 });
dailyCashBookSchema.index({ status: 1 });

module.exports = mongoose.model("DailyCashBook", dailyCashBookSchema);
