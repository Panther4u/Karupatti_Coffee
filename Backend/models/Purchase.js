const mongoose = require("mongoose");

const purchaseSchema = new mongoose.Schema(
  {
    purchaseNumber: { type: String },
    supplier: {
      name: { type: String, default: "" },
      phone: { type: String, default: "" },
    },
    items: [
      {
        productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
        productName: { type: String },
        quantity: { type: Number },
        costPrice: { type: Number },
        total: { type: Number },
      },
    ],
    grandTotal: { type: Number, default: 0 },
    invoiceNumber: { type: String, default: "" },
    date: { type: Date, default: Date.now },
    paidStatus: {
      type: String,
      enum: ["paid", "pending", "partial"],
      default: "paid",
    },
    notes: { type: String, default: "" },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin" },
  },
  { timestamps: true }
);

purchaseSchema.pre("save", async function () {
  if (!this.purchaseNumber) {
    try {
      const Counter = mongoose.model("Counter");
      this.purchaseNumber = await Counter.getNextNumber("purchase", "PUR");
    } catch {
      this.purchaseNumber = "PUR-" + Date.now().toString().slice(-6);
    }
  }
});

module.exports = mongoose.model("Purchase", purchaseSchema);
