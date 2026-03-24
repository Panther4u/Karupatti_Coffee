const mongoose = require("mongoose");

const customerSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    phone: { type: String, sparse: true },
    totalOrders: { type: Number, default: 0 },
    totalSpent: { type: Number, default: 0 },
    lastVisit: { type: Date },
    notes: { type: String, default: "" },
  },
  { timestamps: true }
);

customerSchema.index({ phone: 1 });

module.exports = mongoose.model("Customer", customerSchema);
