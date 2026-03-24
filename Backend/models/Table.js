const mongoose = require("mongoose");

const tableSchema = new mongoose.Schema(
  {
    tableNumber: { type: String, required: true, unique: true },
    capacity: { type: Number, default: 4 },
    status: {
      type: String,
      enum: ["available", "occupied", "reserved", "billing"],
      default: "available",
    },
    currentOrderId: { type: mongoose.Schema.Types.ObjectId, ref: "Order" },
    section: {
      type: String,
      enum: ["indoor", "outdoor", "counter", "parcel"],
      default: "indoor",
    },
    position: {
      x: { type: Number, default: 0 },
      y: { type: Number, default: 0 },
    },
  },
  { timestamps: true }
);

tableSchema.index({ status: 1 });

module.exports = mongoose.model("Table", tableSchema);
