// models/loyalty/redemption.js
import mongoose from "mongoose";

const redemptionSchema = new mongoose.Schema({
  memberId: { type: mongoose.Schema.Types.ObjectId, ref: "Member", required: true },
  voucherId: { type: mongoose.Schema.Types.ObjectId, ref: "Voucher", required: true },
  voucherCode: { type: String, required: true, unique: true },// ma code
  pointsSpent: { type: Number, required: true },
  usedAt: { type: Date, default: null },  
  status: { type: String, enum: ["redeemed", "used", "expired"], default: "redeemed" },
}, { timestamps: true }); 

redemptionSchema.index({ memberId: 1, createdAt: -1 }); 
redemptionSchema.index({ voucherCode: 1 });

const Redemption = mongoose.model("Redemption", redemptionSchema, "redemptions");
export default Redemption;