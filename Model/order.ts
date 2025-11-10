// models/core/order.js
import mongoose from "mongoose";
const { Schema } = mongoose;

const OrderItemSchema = new Schema({
  name: { type: String, require: true },
  quantity: { type: Number, require: true, min: 1 },
  price: { type: Number, require: true },
}, {_id: false});

const OrderSchema = new Schema({
  customer: {
    type: Schema.Types.ObjectId,
    ref: "Member",
    require: true
  },
  items: [OrderItemSchema],
  total_amount: {
    type: Number,
    require: true
  },
  status: {
    type: String,
    enum: ['pending', 'paid', 'shipped', 'cancelled', 'refunded'],
    default: 'pending'
  },
  shipping_address: {
    name: String,
    phone: String,
    address: String
  },
  affiliate_referral: {
    type: Schema.Types.ObjectId,
    ref: 'Affiliate',
    default: null
  },
  redemption_used: {
    type: Schema.Types.ObjectId,
    ref: 'Redemption',
    default: null
  },
}, { timestamps: true }); 

OrderSchema.index({ customer: 1 });
OrderSchema.index({ affiliate_referral: 1 });
OrderSchema.index({ createdAt: -1 });

const Order = mongoose.model('Order', OrderSchema, 'orders');
export default Order;