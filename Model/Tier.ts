import mongoose from "mongoose";

const TierSchema = new mongoose.Schema({
  name: { type: String, required: true },
  min_points: { type: Number, required: true, min: 0 },
  benefits: { type: Object, default: { discount: 0 } },
}, { timestamps: true }); 

const Tier = mongoose.model('Tier', TierSchema, "tiers");
export default Tier;