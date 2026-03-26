const mongoose = require("mongoose");

const settingsSchema = new mongoose.Schema(
  {
    shopName: { type: String, default: "" },
    shopAddress: { type: String, default: "" },
    shopPhone: { type: String, default: "" },
    shopEmail: { type: String, default: "" },
    gstNumber: { type: String, default: "" },
    fssaiNumber: { type: String, default: "" },
    logoUrl: { type: String, default: "" },
    taxEnabled: { type: Boolean, default: false },
    cgstRate: { type: Number, default: 2.5 },
    sgstRate: { type: Number, default: 2.5 },
    inclusiveTax: { type: Boolean, default: true },
    invoicePrefix: { type: String, default: "KC" },
    roundOff: { type: Boolean, default: true },
    receiptWidth: { type: String, enum: ["58", "80"], default: "80" },
    receiptHeader: { type: String, default: "" },
    receiptFooter: { type: String, default: "Thank You! Visit Again" },
    autoPrintBill: { type: Boolean, default: false },
    autoPrintKOT: { type: Boolean, default: false },
    soundEnabled: { type: Boolean, default: true },
    fixedDailyExpenses: [{
      category: { type: String, required: true },
      amount: { type: Number, required: true, min: 0 },
      active: { type: Boolean, default: true },
      isFund: { type: Boolean, default: false }  // true = daily allocation to pot, false = direct expense
    }],
  },
  { timestamps: true }
);

settingsSchema.statics.getSettings = async function () {
  let s = await this.findOne();
  if (!s) s = await this.create({});
  return s;
};

module.exports = mongoose.model("Settings", settingsSchema);
