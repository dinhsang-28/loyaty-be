import mongoose from "mongoose";

const memberSchema = new mongoose.Schema({
  user: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true, 
    unique: true 
  },
  phone: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  dob: { type: Date },
  tier: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tier',
    default: null,
  },
  totalPoints: { type: Number, default: 0 },
  redeemablePoints: { type: Number, default: 0 },
  source: { type: String, default: "ZALO" },
  lastActiveAt: { type: Date, default: Date.now }, //
  
}, { timestamps: true }); 

memberSchema.index({ phone: 1 });
memberSchema.index({ lastActiveAt: 1 });


const Member = mongoose.model("Member", memberSchema, "members");
export default Member;