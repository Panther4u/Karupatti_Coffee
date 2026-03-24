const mongoose = require("mongoose");
require("./Counter"); // Ensure Counter model is registered for pre-save hook

const kotItemSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    qty: { type: Number, required: true, min: 1 },
    notes: { type: String, default: "" },
    status: {
      type: String,
      enum: ["pending", "preparing", "ready"],
      default: "pending",
    },
  },
  { _id: true }
);

const kotSchema = new mongoose.Schema(
  {
    kotNumber: { type: String, unique: true },
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: "Order" },
    items: [kotItemSchema],
    tableNo: { type: String, default: "01" },
    kotType: {
      type: String,
      enum: ["new", "repeat", "modified", "cancelled"],
      default: "new",
    },
    status: {
      type: String,
      enum: ["pending", "in-progress", "completed"],
      default: "pending",
    },
    completedAt: { type: Date },
  },
  { timestamps: true }
);

// Auto-generate KOT number using atomic Counter
kotSchema.pre("save", async function () {
  if (!this.kotNumber) {
    const Counter = mongoose.model("Counter");
    const num = await Counter.getNextNumber("kot", "KOT");
    this.kotNumber = `KOT-${num.split("/").pop()}`;
  }
});

kotSchema.index({ status: 1 });
kotSchema.index({ createdAt: -1 });

module.exports = mongoose.model("KOT", kotSchema);
