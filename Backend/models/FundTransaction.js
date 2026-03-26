const mongoose = require("mongoose");

const fundTransactionSchema = new mongoose.Schema({
  potCategory: { type: String, required: true },
  type: { type: String, enum: ["allocation", "payout"], required: true },
  amount: { type: Number, required: true },
  date: { type: String, required: true },  // YYYY-MM-DD
  notes: { type: String, default: "" },
  balanceAfter: { type: Number, default: 0 },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "Admin" },
}, { timestamps: true });

fundTransactionSchema.index({ date: -1 });
fundTransactionSchema.index({ potCategory: 1, date: -1 });

module.exports = mongoose.model("FundTransaction", fundTransactionSchema);
