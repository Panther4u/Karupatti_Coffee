const mongoose = require("mongoose");

const expenseSchema = new mongoose.Schema(
  {
    category: { type: String, required: true },
    amount: { type: Number, required: true, min: 0 },
    notes: { type: String, default: "" },
    type: { type: String, enum: ["in", "out"], default: "out" },
    method: { type: String, default: "Cash" },
    date: { type: String, required: true },
    source: { type: String, enum: ["manual", "fixed"], default: "manual" },
  },
  { timestamps: true }
);

// Indexes for query performance
expenseSchema.index({ date: -1 });
expenseSchema.index({ category: 1 });

module.exports = mongoose.model("Expense", expenseSchema);
