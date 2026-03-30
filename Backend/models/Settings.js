const mongoose = require("mongoose");

const settingsSchema = new mongoose.Schema(
  {
    shopName: { type: String, default: "NELLAI KARUPATTI COFFEE" },
    shopTagline: { type: String, default: "" },
    shopAddress: { type: String, default: "" },
    shopCity: { type: String, default: "" },
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
    productCategories: [{ type: String }],
    expenseCategories: [{ type: String }],
    fixedDailyExpenses: [{
      category: { type: String, required: true },
      amount: { type: Number, required: true, min: 0 },
      active: { type: Boolean, default: true },
      isFund: { type: Boolean, default: false }  // true = daily allocation to pot, false = direct expense
    }],
  },
  { timestamps: true }
);

const DEFAULT_PRODUCT_CATEGORIES = ["Tea","Coffee","Dairy Products","Snacks","Evening Special","Fresh Juice","Cool Drinks","Ice Cream","Karupatti Ice Cream","Karupatti Snacks","Other Snacks","Biscuits & Cakes","Parcel"];
const DEFAULT_EXPENSE_CATEGORIES = ["Milk","Curd","Grocery & Vegetables","Essential Items","Samosa","Puffs","Water","Wastage","Other","Salary","Rent","EB","Gas"];

settingsSchema.statics.getSettings = async function () {
  let s = await this.findOne();
  if (!s) {
    try {
      s = await this.create({ productCategories: DEFAULT_PRODUCT_CATEGORIES, expenseCategories: DEFAULT_EXPENSE_CATEGORIES });
    } catch (e) {
      s = await this.findOne();
    }
  }
  // Backfill if arrays are empty (existing installs)
  let needSave = false;
  if (!s.productCategories || s.productCategories.length === 0) { s.productCategories = DEFAULT_PRODUCT_CATEGORIES; needSave = true; }
  if (!s.expenseCategories || s.expenseCategories.length === 0) { s.expenseCategories = DEFAULT_EXPENSE_CATEGORIES; needSave = true; }
  if (needSave) await s.save();
  return s;
};

module.exports = mongoose.model("Settings", settingsSchema);
