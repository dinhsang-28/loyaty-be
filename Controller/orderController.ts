// controllers/orderController.ts
import { Request, Response, NextFunction } from "express";
import mongoose from "mongoose";
import { LoyaltyService } from "../service/LoyaltyService";
import { AffiliateService } from "../service/AffiliateService";
import Order from "../Model/order";
import Member from "../Model/member";
import Affiliate from "../Model/affiliate";
import Redemption from "../Model/redemption";
import MessageLog from "../Model/messageLog";
// import { sendZaloMessage } from "../helpers/zalo";

// [POST] /orders (Yêu cầu đăng nhập)
// thanh toán thành công
export const createOrder = async (req: Request, res: Response) => {
  //  Lấy thông tin
  const memberId = (req as any).user?.memberId;
  const { items, total_amount, shipping_address, redemptionCode } = req.body;
  const affiliateRef = req.cookies.affiliate_ref; // Lấy từ cookie

  if (!memberId || !items || !total_amount) {
    return res.status(400).json({ message: "Thiếu thông tin đơn hàng hoặc khách hàng" });
  }
  const session = await mongoose.startSession();
  session.startTransaction();
  let newOrder: any;
  let member: any;
  let affiliate: any;
  let finalAmount = total_amount;
  let redemptionUsedId: string | null = null;
  let affiliateId: string | null = null;
  let pointsEarned = 0;
  let commissionEarned = 0;
  try {
    // Tìm Member
    member = await Member.findById(memberId).session(session);
    if (!member) throw new Error("Không tìm thấy khách hàng");

    // Xử lý Đổi Voucher (Redemption)
    if (redemptionCode) {
      const redemption = await Redemption.findOne({ 
        voucherCode: redemptionCode,
        status: "redeemed" // Chỉ dùng mã chưa xài
      }).populate('voucherId').session(session);
      
      if (!redemption) throw new Error("Mã giảm giá không hợp lệ hoặc đã được dùng");

      // vi du la voucher là giảm tiền trực tiếp (ví dụ: { type: 'fixed', value: 50000 })
      const discount = (redemption.voucherId as any)?.benefits?.value || 0;
      finalAmount -= discount;
      if (finalAmount < 0) finalAmount = 0;

      // Cập nhật trạng thái
      redemption.status = "used";
      redemption.usedAt = new Date();
      await redemption.save({ session });
      redemptionUsedId = redemption._id.toString();
    }

    // Xử lý Affiliate (nếu có)
    if (affiliateRef) {
      affiliate = await Affiliate.findOne({ referral_code: affiliateRef }).session(session);
      if (affiliate) {
        affiliateId = affiliate._id;
      }
    }

    // Tạo Đơn hàng (Order)
    [newOrder] = await Order.create(
      [{
        customer: memberId,
        items: items,
        total_amount: finalAmount, // Số tiền cuối cùng sau khi giảm giá
        original_amount: total_amount, // (Nên thêm trường này)
        status: "paid",
        shipping_address: shipping_address || null,
        affiliate_referral: affiliateId,
        redemption_used: redemptionUsedId
      }],
      { session }
    );

    // GỌI LOYALTY SERVICE (Tích điểm trên số tiền đã có sẵn)
    const loyaltyResult = await LoyaltyService.earnPoints(
      member,
      finalAmount, // Tích điểm trên số tiền đã trả
      session,
      newOrder._id.toString()
    );
    pointsEarned = loyaltyResult.points;

    // GỌI AFFILIATE SERVICE
    if (affiliate) {
      const affResult = await AffiliateService.trackAffiliateCommission(
        affiliate._id,
        finalAmount, // Tính hoa hồng trên số tiền đã trả
        newOrder._id.toString(),
        session
      );
      commissionEarned = affResult.affiliateCommission;
    }

    //Lưu các thay đổi
    await member.save({ session });
    if (affiliate) {
      await affiliate.save({ session });
    }

    //Commit
    await session.commitTransaction();

  } catch (err: any) {
    await session.abortTransaction();
    return res.status(500).json({ success: false, message: err.message });
  } finally {
    session.endSession();
  }

  //  Xóa cookie & Gửi thông báo (bất đồng bộ)
  try {
    if (affiliateId) {
      res.clearCookie("affiliate_ref");
    }
    
    // Gửi Zalo/SMS cho Member
    // sendZaloMessage(member.phone, `Don hang ${newOrder._id} thanh cong. Ban duoc cong ${pointsEarned} diem.`);
    MessageLog.create({
      memberId: member._id,
      channel: "ZNS",
      payload: { orderId: newOrder._id, points: pointsEarned },
      status: "queued"
    });

    // Gửi email cho Affiliate (nếu có)
    // if(affiliate && commissionEarned > 0) ... sendMail(...)

  } catch (notifyErr: any) {
    console.error("Lỗi gửi thông báo:", notifyErr.message);
  }

  return res.status(201).json({
    success: true,
    message: "Tạo đơn hàng và tích điểm thành công!",
    data: newOrder
  });
};