// models/affiliate/affiliateOrder.js
import mongoose from "mongoose";

const AffiliateOrderSchema = new mongoose.Schema({
  affiliate: { type: mongoose.Schema.Types.ObjectId, ref: 'Affiliate', required: true },
  order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true }, 
  order_value: { type: Number, required: true },
  commission_amount: { type: Number, required: true },
  status: { type: String, enum: ['pending', 'paid', 'canceled'], default: 'pending' },
  meta: Object,
}, { timestamps: true }); // <-- ĐÃ THÊM

AffiliateOrderSchema.index({ affiliate: 1, status: 1 });

const AffiliateOrder = mongoose.model('AffiliateOrder', AffiliateOrderSchema, "affiliate_orders");
export default AffiliateOrder;