const mongoose = require("mongoose");

const discountSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    type: {
      type: String,
      enum: ["percentage", "flat", "bogo", "combo", "happy_hour"],
      required: true,
    },
    value: { type: Number, default: 0 },
    applicableProducts: [{ type: mongoose.Schema.Types.ObjectId, ref: "Product" }],
    applicableCategories: [{ type: Number }],
    minimumOrder: { type: Number, default: 0 },
    maximumDiscount: { type: Number },
    schedule: {
      enabled: { type: Boolean, default: false },
      startTime: { type: String },
      endTime: { type: String },
      days: [{ type: String }],
    },
    bogoConfig: {
      buyQty: { type: Number, default: 2 },
      getQty: { type: Number, default: 1 },
    },
    comboConfig: {
      items: [
        {
          productId: { type: mongoose.Schema.Types.ObjectId },
          qty: { type: Number },
        },
      ],
      comboPrice: { type: Number },
    },
    active: { type: Boolean, default: true },
    validFrom: { type: Date },
    validTo: { type: Date },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin" },
  },
  { timestamps: true }
);

discountSchema.index({ active: 1 });

module.exports = mongoose.model("Discount", discountSchema);
