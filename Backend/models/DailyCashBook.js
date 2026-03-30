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
  denomination: {
    n2000: { type: Number, default: 0 },
    n500: { type: Number, default: 0 },
    n200: { type: Number, default: 0 },
    n100: { type: Number, default: 0 },
    n50: { type: Number, default: 0 },
    n20: { type: Number, default: 0 },
    n10: { type: Number, default: 0 },
    coins: { type: Number, default: 0 },
  },
  manualUpiAmount: { type: Number, default: null },
  manualCardAmount: { type: Number, default: null },
  manualCashAmount: { type: Number, default: null },
}, { timestamps: true });

dailyCashBookSchema.index({ date: -1 });
dailyCashBookSchema.index({ status: 1 });

module.exports = mongoose.model("DailyCashBook", dailyCashBookSchema);
