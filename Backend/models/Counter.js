const mongoose = require("mongoose");

const counterSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  prefix: { type: String, default: "KC" },
  currentNumber: { type: Number, default: 0 },
  financialYear: { type: String },
  lastReset: { type: Date, default: Date.now },
});

function getFinancialYear() {
  const now = new Date();
  const m = now.getMonth();
  const y = now.getFullYear();
  if (m >= 3) return y + "-" + String(y + 1).slice(-2);
  return y - 1 + "-" + String(y).slice(-2);
}

/**
 * Atomically get the next sequential number.
 * Handles financial year rollover within the atomic operation.
 */
counterSchema.statics.getNextNumber = async function (counterName, prefix) {
  const fy = getFinancialYear();

  // First, try to reset FY atomically if needed
  await this.findOneAndUpdate(
    { name: counterName || "invoice", financialYear: { $ne: fy } },
    {
      $set: {
        currentNumber: 0,
        financialYear: fy,
        lastReset: new Date(),
        prefix: prefix || "KC",
      },
    },
    { upsert: false }
  );

  // Now atomically increment
  const counter = await this.findOneAndUpdate(
    { name: counterName || "invoice" },
    {
      $inc: { currentNumber: 1 },
      $setOnInsert: {
        prefix: prefix || "KC",
        financialYear: fy,
        lastReset: new Date(),
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  return (
    (prefix || "KC") +
    "-" +
    fy +
    "/" +
    String(counter.currentNumber).padStart(6, "0")
  );
};

module.exports = mongoose.model("Counter", counterSchema);
