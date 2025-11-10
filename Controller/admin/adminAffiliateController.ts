import { Request, Response } from "express";
import mongoose from "mongoose";
import AffiliateTier from "../../Model/affiliateTier";
import AffiliateOrder from "../../Model/affiliateOrder";
import Affiliate from "../../Model/affiliate";

// --- AFFILIATE TIER (CẤP BẬC) MANAGEMENT ---
// [POST] /admin/affiliate/tiers
export const createAffiliateTier = async (req: Request, res: Response) => {
  try {
    const tier = new AffiliateTier(req.body);
    await tier.save();
    res.status(201).json({ success: true, data: tier });
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message });
  }
};

// [GET] /admin/affiliate/tiers
export const getAffiliateTiers = async (req: Request, res: Response) => {
  try {
    const tiers = await AffiliateTier.find().sort({ min_sales: 1 });
    res.status(200).json({ success: true, data: tiers });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// [PATCH] /admin/affiliate/tiers/:id
export const updateAffiliateTier = async (req: Request, res: Response) => {
  try {
    const tier = await AffiliateTier.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!tier) return res.status(404).json({ success: false, message: "Không tìm thấy Hạng" });
    res.status(200).json({ success: true, data: tier });
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message });
  }
};

// --- AFFILIATE ORDER (DUYỆT HOA HỒNG) MANAGEMENT ---

// [GET] /admin/affiliate/orders
// Lấy danh sách hoa hồng, lọc theo trạng thái (pending, paid, canceled)
export const getAffiliateOrders = async (req: Request, res: Response) => {
  try {
    const { status } = req.query; // ?status=pending
    
    const filter: any = {};
    if (status) {
      filter.status = status;
    }
    
    const orders = await AffiliateOrder.find(filter)
      .populate('affiliate', 'name email')
      .populate('order', 'total_amount')
      .sort({ createdAt: -1 });
      
    res.status(200).json({ success: true, data: orders });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * [PATCH] /admin/affiliate/orders/:id/approve
 * Duyệt một hoa hồng (chuyển 'pending' -> 'paid'). 
 * Đây là lúc cộng tiền vào số dư 'total_commission' cho affiliate.
 */
export const approveAffiliateOrder = async (req: Request, res: Response) => {
  const { id } = req.params;
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    const affOrder = await AffiliateOrder.findById(id).session(session);
    if (!affOrder) throw new Error("Không tìm thấy hoa hồng này");
    if (affOrder.status !== 'pending') throw new Error("Hoa hồng đã được xử lý");

    // 1. Cập nhật trạng thái
    affOrder.status = 'paid'; // 'paid' ở đây nghĩa là "đã duyệt hoa hồng"

    // 2. Cộng tiền vào số dư (total_commission) của Affiliate
    await Affiliate.updateOne(
      { _id: affOrder.affiliate },
      { $inc: { total_commission: affOrder.commission_amount } },
      { session }
    );
    
    await affOrder.save({ session });
    await session.commitTransaction();
    
    // Gửi mail cho Affiliate...
    
    res.status(200).json({ success: true, message: "Đã duyệt hoa hồng", data: affOrder });

  } catch (err: any) {
    await session.abortTransaction();
    res.status(500).json({ success: false, message: err.message });
  } finally {
    session.endSession();
  }
};

/**
 * [PATCH] /admin/affiliate/orders/:id/cancel
 * Hủy một hoa hồng (chuyển 'pending' -> 'canceled'). 
 * Thường dùng khi đơn hàng gốc bị hoàn trả.
 */
export const cancelAffiliateOrder = async (req: Request, res: Response) => {
  const { id } = req.params;
  
  try {
    const affOrder = await AffiliateOrder.findById(id);
    if (!affOrder) return res.status(404).json({ message: "Không tìm thấy" });
    if (affOrder.status !== 'pending') return res.status(400).json({ message: "Đã xử lý" });

    affOrder.status = 'canceled';
    await affOrder.save();
    
    res.status(200).json({ success: true, message: "Đã hủy hoa hồng", data: affOrder });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};