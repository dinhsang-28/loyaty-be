import mongoose from "mongoose";

const messageLogSchema = new mongoose.Schema({
  memberId: { type: mongoose.Schema.Types.ObjectId, ref: "Member" },
  channel: { type: String, enum: ["ZNS", "ZALO_OA"], required: true },
  templateId: { type: String },
  payload: { type: Object },
  status: { type: String, enum: ["sent", "failed", "queued"], default: "queued" },
  providerResponse: { type: Object },
  sentAt: { type: Date }, 
}, { timestamps: true }); 

messageLogSchema.index({ memberId: 1, createdAt: -1 }); 

const MessageLog = mongoose.model("MessageLog", messageLogSchema, "message_logs");
export default MessageLog;