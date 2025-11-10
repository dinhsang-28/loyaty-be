// models/logs/pointTransaction.js
import mongoose from "mongoose";

const pointTransactionSchema = new mongoose.Schema({
  memberId: { type: mongoose.Schema.Types.ObjectId, ref: "Member", required: true },
  type: { type: String, enum: ["earn", "spend", "adjust", "expire"], required: true },
  amount: { type: Number, required: true },
  source: { type: String, required: true },
  refId: { type: String },
  description: { type: String },
  expiresAt: { type: Date }, 
}, { timestamps: true }); 

pointTransactionSchema.index({ memberId: 1, createdAt: -1 });

const PointTransaction = mongoose.model("PointTransaction", pointTransactionSchema, "point_transactions");
export default PointTransaction;