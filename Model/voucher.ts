// models/loyalty/voucher.js
import mongoose from "mongoose";

const voucherSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String },
  pointsRequired: { type: Number, required: true },// yeu cau du diem
  totalQuantity: { type: Number, default: 0 }, // tong so luong
  remainingQuantity: { type: Number, default: 0 },
  validFrom: { type: Date, default: Date.now }, 
  validTo: { type: Date }, 
  status: { type: String, enum: ["active", "expired", "inactive"], default: "active" },
}, { timestamps: true }); 

voucherSchema.index({ status: 1, validTo: 1 });

const Voucher = mongoose.model("Voucher", voucherSchema, "vouchers");
export default Voucher;