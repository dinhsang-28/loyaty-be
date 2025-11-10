
import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
  phone: { type: String, unique: true, sparse: true,require:true },
  email: { type: String, unique: true, sparse: true,require:true },
  password: { type: String, require: true },
  role:{type:String,enum:["member","admin"],default:"member"},
  memberProfile: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Member', 
    default: null 
  },
  affiliateProfile: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Affiliate', 
    default: null 
  },
}, { timestamps: true }); 

// userSchema.index({ phone: 1 });
// userSchema.index({ email: 1 });

const User = mongoose.model("User", userSchema, "users");
export default User;