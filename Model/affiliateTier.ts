// models/affiliate/affiliateTier.js
import mongoose from "mongoose";

const AffiliateTierSchema = new mongoose.Schema({
  name: { type: String, required: true },
  commission_rate: { type: Number, required: true },
  min_sales: { type: Number, required: true, default: 0 },
}, { timestamps: true }); // <-- ĐÃ THÊM

const AffiliateTier = mongoose.model('AffiliateTier', AffiliateTierSchema, "affiliate_tiers");
export default AffiliateTier;