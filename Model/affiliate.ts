import mongoose from "mongoose";

const AffiliateSchema = new mongoose.Schema({
  user: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true, 
    unique: true 
  },
  name: String,
  phone: String,
  email: String,
  referral_code: { type: String, unique: true, required: true },
  tier: { type: mongoose.Schema.Types.ObjectId, ref: 'AffiliateTier', default: null },
  total_sales: { type: Number, default: 0 },
  total_commission: { type: Number, default: 0 },
  status: { type: String, enum: ['active', 'inactive'], default: 'active' },
}, { timestamps: true }); 

AffiliateSchema.index({ referral_code: 1 });

const Affiliate = mongoose.model('Affiliate', AffiliateSchema, "affiliates");
export default Affiliate;