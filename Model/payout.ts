import mongoose from "mongoose";

const PayoutSchema = new mongoose.Schema({
  affiliate: { type: mongoose.Schema.Types.ObjectId, ref: 'Affiliate', required: true },
  amount: { type: Number, required: true },
  status: { 
    type: String, 
    enum: ['requested', 'approved', 'rejected', 'paid'], 
    default: 'requested' 
  },
}, { timestamps: true }); 

PayoutSchema.index({ affiliate: 1, status: 1 });

const Payout = mongoose.model('Payout', PayoutSchema, 'payouts');
export default Payout;