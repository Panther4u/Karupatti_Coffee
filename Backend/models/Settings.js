const mongoose = require("mongoose");

const settingsSchema = new mongoose.Schema(
  {
    shopName: { type: String, default: "Karupatti Coffee" },
    shopAddress: { type: String, default: "North Pradakshanam Road, Karur" },
    shopPhone: { type: String, default: "7010452495" },
    shopEmail: { type: String, default: "" },
    gstNumber: { type: String, default: "33GGTPS6619J1ZJ" },
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
  },
  { timestamps: true }
);

settingsSchema.statics.getSettings = async function () {
  let s = await this.findOne();
  if (!s) s = await this.create({});
  return s;
};

module.exports = mongoose.model("Settings", settingsSchema);
