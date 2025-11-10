
import mongoose from "mongoose";

const memberTierLogSchema = new mongoose.Schema({
  memberId: { type: mongoose.Schema.Types.ObjectId, ref: "Member", required: true },
  oldTier: { type: mongoose.Schema.Types.ObjectId, ref: "Tier", default: null },
  newTier: { type: mongoose.Schema.Types.ObjectId, ref: "Tier", required: true },
  reason: { type: String },
}, { timestamps: true }); 

memberTierLogSchema.index({ memberId: 1, createdAt: -1 }); 
const MemberTierLog = mongoose.model("MemberTierLog", memberTierLogSchema, "member_tier_logs");
export default MemberTierLog;