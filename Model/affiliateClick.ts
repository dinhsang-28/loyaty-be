
import mongoose from "mongoose";

const AffiliateClickSchema = new mongoose.Schema({
  affiliate: { type: mongoose.Schema.Types.ObjectId, ref: "Affiliate", required: true },
  ip: String,
  userAgent: String,
}, { timestamps: true }); 

AffiliateClickSchema.index({ affiliate: 1, createdAt: -1 }); 

const AffiliateClick = mongoose.model("AffiliateClick", AffiliateClickSchema, "affiliate_clicks");
export default AffiliateClick;