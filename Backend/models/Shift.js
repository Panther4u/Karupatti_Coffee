const mongoose = require("mongoose");

const shiftSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "Admin" },
    userName: { type: String, default: "" },
    startTime: { type: Date, default: Date.now },
    endTime: { type: Date },
    openingCash: { type: Number, required: true },
    closingCash: { type: Number },
    expectedCash: { type: Number, default: 0 },
    difference: { type: Number, default: 0 },
    totalOrders: { type: Number, default: 0 },
    totalRevenue: { type: Number, default: 0 },
    cashRevenue: { type: Number, default: 0 },
    upiRevenue: { type: Number, default: 0 },
    cardRevenue: { type: Number, default: 0 },
    status: { type: String, enum: ["active", "closed"], default: "active" },
  },
  { timestamps: true }
);

shiftSchema.index({ status: 1 });
shiftSchema.index({ userId: 1 });

module.exports = mongoose.model("Shift", shiftSchema);
