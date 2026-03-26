const mongoose = require("mongoose");

const fundPotSchema = new mongoose.Schema({
  category: { type: String, required: true },
  // Running balance (accumulated daily allocations minus payouts)
  balance: { type: Number, default: 0 },
  // Total allocated all-time
  totalAllocated: { type: Number, default: 0 },
  // Total paid out all-time
  totalPaidOut: { type: Number, default: 0 },
}, { timestamps: true });

fundPotSchema.index({ category: 1 }, { unique: true });

module.exports = mongoose.model("FundPot", fundPotSchema);
