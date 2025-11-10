// controllers/admin/adminLoyaltyController.ts
import { Request, Response } from "express";
import Tier from "../../Model/Tier";
import Voucher from "../../Model/voucher";
import Member from "../../Model/member";
import PointTransaction from "../../Model/pointTransaction";
import mongoose from "mongoose";
import { LoyaltyService } from "../../service/LoyaltyService";

// --- TIER (CẤP BẬC) MEMBER ---

// [POST] /admin/loyalty/tiers
export const createTier = async (req: Request, res: Response) => {
  try {
    const { name, min_points, benefits } = req.body;
    const tier = new Tier({ name, min_points, benefits });
    await tier.save();
    res.status(201).json({ success: true, data: tier });
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message });
  }
};

// [GET] /admin/loyalty/tiers
export const getTiers = async (req: Request, res: Response) => {
  try {
    const tiers = await Tier.find().sort({ min_points: 1 });
    res.status(200).json({ success: true, data: tiers });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// [PATCH] /admin/loyalty/tiers/:id
export const updateTier = async (req: Request, res: Response) => {
  try {
    const tier = await Tier.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!tier) return res.status(404).json({ success: false, message: "Không tìm thấy Hạng" });
    res.status(200).json({ success: true, data: tier });
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message });
  }
};

// [DELETE] /admin/loyalty/tiers/:id
export const deleteTier = async (req: Request, res: Response) => {
  try {
    const tier = await Tier.findByIdAndDelete(req.params.id);
    if (!tier) return res.status(404).json({ success: false, message: "Không tìm thấy Hạng" });
    res.status(200).json({ success: true, message: "Đã xóa Hạng" });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// --- VOUCHER (QUÀ ĐỔI) MANAGEMENT ---

// [POST] /admin/loyalty/vouchers
export const createVoucher = async (req: Request, res: Response) => {
  try {
    const voucher = new Voucher(req.body);
    await voucher.save();
    res.status(201).json({ success: true, data: voucher });
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message });
  }
};

// [GET] /admin/loyalty/vouchers
export const getVouchers = async (req: Request, res: Response) => {
  try {
    const vouchers = await Voucher.find().sort({ createdAt: -1 });
    res.status(200).json({ success: true, data: vouchers });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// [PATCH] /admin/loyalty/vouchers/:id
export const updateVoucher = async (req: Request, res: Response) => {
  try {
    const voucher = await Voucher.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!voucher) return res.status(404).json({ success: false, message: "Không tìm thấy Voucher" });
    res.status(200).json({ success: true, data: voucher });
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message });
  }
};

// --- MEMBER (THÀNH VIÊN) MANAGEMENT ---

// [GET] /admin/loyalty/members
export const getMembers = async (req: Request, res: Response) => {
    // Thêm logic tìm kiếm, phân trang ở đây
    try {
        const members = await Member.find().populate('tier').sort({ createdAt: -1 });
        res.status(200).json({ success: true, data: members });
    } catch (err: any) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// [POST] /admin/loyalty/members/adjust-points
// Admin cộng/trừ điểm thủ công
export const adjustMemberPoints = async (req: Request, res: Response) => {
  const { memberId, amount, reason } = req.body; // amount có thể là số âm
  if (!memberId || !amount || !reason) {
    return res.status(400).json({ message: "Thiếu memberId, amount, hoặc reason" });
  }

  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const member = await Member.findById(memberId).session(session);
    if (!member) throw new Error("Không tìm thấy member");
    
    // Ghi log
    await PointTransaction.create(
      [{
        memberId: member._id,
        type: "adjust", // Loại "điều chỉnh"
        amount: amount,
        source: "admin_adjust",
        description: reason
      }],
      { session }
    );
    
    // Cập nhật điểm
    member.redeemablePoints += amount;
    
    // Nếu là cộng điểm, thì cũng cộng vào totalPoints để xét hạng
    if (amount > 0) {
        member.totalPoints += amount;
        await LoyaltyService.updateMemberTier(member, session); // Kiểm tra nâng hạng
    }
    
    await member.save({ session });
    await session.commitTransaction();
    
    res.status(200).json({ success: true, data: member });

  } catch (err: any) {
    await session.abortTransaction();
    res.status(500).json({ success: false, message: err.message });
  } finally {
    session.endSession();
  }
};