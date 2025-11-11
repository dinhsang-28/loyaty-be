// models/loyalty/voucher.js
import mongoose from "mongoose";

const voucherSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String },
  pointsRequired: { type: Number, required: true },// yeu cau du diem
  totalQuantity: { type: Number, default: 0 }, // tong so luong vouncher
  remainingQuantity: { type: Number, default: 0 },
  validFrom: { type: Date, default: Date.now },
  validTo: { type: Date },
  status: { type: String, enum: ["active", "expired", "inactive"], default: "active" },
  // dung doi cho online
  benefit: {
    type: String,
    enum: ['fixed', 'percentage'],
    required: true
  },//loai giam gia
  value: {
    type: Number,
    required: true
  },// type: fixed = 50.000d   hay type: percentage = 50%
  minValue: {
    type: Number,
    default: 0
  },// diem toi thieu de doi duoc don hang
  maxDiscount: { type: Number }// Muc giam gia toi da (vd:giam 10% toi da 50.000d)

}, { timestamps: true });

voucherSchema.index({ status: 1, validTo: 1 });

const Voucher = mongoose.model("Voucher", voucherSchema, "vouchers");
export default Voucher;