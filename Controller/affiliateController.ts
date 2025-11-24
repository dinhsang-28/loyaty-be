import { Request, Response, NextFunction } from "express";
import mongoose from "mongoose";
import Affiliate from "../Model/affiliate";
import Payout from "../Model/payout";
import AffiliateClick from "../Model/affiliateClick";
import AffiliateOrder from "../Model/affiliateOrder";
// import sendMail from "../helpers/sendMail";
// [GET] /affiliate/profile (Yêu cầu đăng nhập Affiliate,xem profile)
export const getProfile = async (req: Request, res: Response) => {
  const affiliateId = (req as any).user?.affiliateId;
  if (!affiliateId) return res.status(401).json({ message: "Yêu cầu đăng nhập affiliate" });
  try {
    const affiliate = await Affiliate.findById(affiliateId).populate("tier");
    if (!affiliate) return res.status(404).json({ message: "Không tìm thấy hồ sơ" });
    res.status(200).json({ success: true, data: affiliate });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};
// [POST] /affiliate/request-payout (Yêu cầu đăng nhập Affiliate,yeu cau doi thuong)
export const requestPayout = async (req: Request, res: Response) => {
  const affiliateId = (req as any).user?.affiliateId;
  const { amount } = req.body;
  if (!affiliateId) return res.status(401).json({ message: "Yêu cầu đăng nhập affiliate" });
  if (!amount || amount <= 0) return res.status(400).json({ message: "Số tiền không hợp lệ" });
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const affiliate = await Affiliate.findById(affiliateId).session(session);
    if (!affiliate) {
      return res.status(403).json({ message: "khong tim thay affiliate" })
    }
    // Kiểm tra các yêu cầu đang chờ
    const existing = await Payout.findOne({
      affiliate: affiliateId,
      status: "requested"
    }).session(session);
    if (existing) {
      return res.status(400).json({ message: "ban dang co mot yeu cau dang cho" })
    }
    // Kiểm tra số dư (total_commission là số dư có thể rút)
    if (affiliate.total_commission < amount) {
      return res.status(400).json({ message: "so du khong du" })
    }
    // Tạo Payout
    await Payout.create(
      [{
        affiliate: affiliate._id,
        amount: amount,
        status: "requested",
        balance_after: affiliate.total_commission - amount
      }],
      { session }
    );
    // Trừ tiền khỏi số dư
    affiliate.total_commission -= amount;
    affiliate.total_commission = Math.round(affiliate.total_commission * 100) / 100;
    await affiliate.save({ session });
    await session.commitTransaction();
    // sendMail cho admin
    res.status(200).json({ success: true, message: "Gửi yêu cầu rút tiền thành công" });
  } catch (err: any) {
    await session.abortTransaction();
    res.status(500).json({ success: false, message: err.message });
  } finally {
    session.endSession();
  }
};
// [GET] /affiliate/payouts (Yêu cầu đăng nhập Affiliate  , xem lich su rut tien)
export const getPayoutHistory = async (req: Request, res: Response) => {

  const affiliateId = (req as any).user?.affiliateId;
  if (!affiliateId) return res.status(401).json({ message: "Yêu cầu đăng nhập affiliate" });
  try {
    const payouts = await Payout.find({ affiliate: affiliateId })
      .sort({ createdAt: -1 });
    res.status(200).json({ success: true, data: payouts });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};
// [GET] /affiliate/summary (Yêu cầu đăng nhập Affiliate,xem thong ke rut tien)
export const getSummary = async (req: Request, res: Response) => {
  const affiliateId = (req as any).user?.affiliateId;
  if (!affiliateId) return res.status(401).json({ message: "Yêu cầu đăng nhập affiliate" });
  try {
    const affIdObject = new mongoose.Types.ObjectId(affiliateId);

    const [affiliate, payoutStatus, totalClicks, totalOrder] = await Promise.all([
      //lay thong tin nguoi dung
      Affiliate.findById(affiliateId).lean(),
      // thong ke payout
      Payout.aggregate([
        { $match: { affiliate: affIdObject } },
        {
          $group: {
            _id: "$status",
            total: { $sum: "$amount" }
          }
        }
      ]),
      // dem tong so click
      AffiliateClick.countDocuments({ affiliate: affIdObject }),
      // dem tong so don hang
      AffiliateOrder.countDocuments({ affiliate: affIdObject })
    ]);
    if (!affiliate) {
      return res.status(400).json({ message: "khong tim thay ho so" })
    }
    const stats = {
      requested: 0,
      approved: 0,
      paid: 0,
      rejected: 0,
    }
    payoutStatus.forEach(stat => {
      if (stats.hasOwnProperty(stat._id)) {
        stats[stat._id] = stat.total;
      }
    })
    //tinh toan viec click hoa hong
    const conversionRate = totalClicks > 0 ? ((totalOrder / totalClicks) * 100).toFixed(2) : "0";

   return res.status(200).json({
      success: true,
      data: {
        // Dữ liệu tài chính
        total_commission_balance: affiliate.total_commission,
        total_sales: affiliate.total_sales,
        pending_request: stats.requested,
        approved_waiting_payment: stats.approved,
        paid_total: stats.paid,

        // Dữ liệu cho dashboard
        totalClicks: totalClicks,
        totalOrders: totalOrder,
        conversionRate: `${conversionRate}%`
      }
    })
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};
// [GET] /track (Công khai)
export const trackAffiliateClick = async (req: Request, res: Response) => {
  const { ref } = req.query;
  if (!ref) return res.status(400).json({ message: "Thiếu mã ref" });
  try {
    const affiliate = await Affiliate.findOne({ referral_code: ref as string });
    if (!affiliate) {
      // Vẫn redirect nhưng không lưu cookie
      const redirectUrl = process.env.FRONTEND_URL || "/";
      if (redirectUrl === "/") {
        return res.json({ message: "Mã ref không tồn tại" });
      }
      return res.redirect(redirectUrl);
    }

    // Ghi lại lượt click
    await AffiliateClick.create({
      affiliate: affiliate._id,
      ip: req.ip,
      userAgent: req.headers["user-agent"],
    });
    // Lưu cookie (hiệu lực 7 ngày)
    res.cookie("affiliate_ref", ref, {
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 ngày
      httpOnly: true,
      secure: process.env.NODE_ENV === "production" // Chỉ https khi production
    });
    // Redirect về trang chủ
    const redirectUrl = process.env.FRONTEND_URL || "/";
    if (redirectUrl === "/") {
      return res.json({
        success: true,
        message: "Đã ghi nhận click affiliate (dev mode)",
        ref,
      });
    } else {
      return res.redirect(redirectUrl);
    }

  } catch (err: any) {
    console.error("Lỗi track click:", err.message);
    return res.redirect(process.env.FRONTEND_URL || "/");
  }
};

// [GET] /affiliate/status/:referral_code (Công khai)
export const getAffiliateStats = async (req: Request, res: Response) => {

  try {
    const { referral_code } = req.params;

    const affiliate = await Affiliate.findOne({ referral_code });
    if (!affiliate) {
      return res.status(404).json({ success: false, message: "Affiliate không tồn tại" });
    }
    // Đếm số lượt click
    const totalClicks = await AffiliateClick.countDocuments({ affiliate: affiliate._id });
    console.log("tong luot click:" + totalClicks);

    // Đếm số đơn hàng từ affiliate này
    const totalOrders = await AffiliateOrder.countDocuments({ affiliate: affiliate._id });
    console.log("so don hang da mua tu viec click affiliate:" + totalOrders);

    // Tính conversion rate (%)
    const conversionRate = totalClicks > 0 ? ((totalOrders / totalClicks) * 100).toFixed(2) : "0";
    console.log("% tu viec nhan affiliate:" + conversionRate);
    return res.status(200).json({
      success: true,
      data: {
        affiliate: {
          name: affiliate.name,
          email: affiliate.email,
          referral_code: affiliate.referral_code,
        },
        totalClicks,
        totalOrders,
        conversionRate: `${conversionRate}%`,
      },
    });
  } catch (err: any) {
    console.error(err);
    return res.status(500).json({ success: false, message: err.message });
  }
};