import { Request, Response } from "express";
import mongoose from "mongoose";
import crypto from "crypto";
import Member from "../../Model/member";
import Tier from "../../Model/Tier";
import Voucher from "../../Model/voucher";
import Redemption from "../../Model/redemption";
import PointTransaction from "../../Model/pointTransaction";
import MessageLog from "../../Model/messageLog";
import { LoyaltyService } from "../../service/LoyaltyService";

/**
 * [GET] /api/public/staff/lookup/:phone
 * * Nhân viên tra cứu toàn bộ thông tin khách hàng bằng SĐT.
 */
export const staffLookupCustomer = async (req: Request, res: Response) => {
  const { phone } = req.params;
  if (!phone) {
    return res.status(400).json({ success: false, message: "Vui lòng nhập số điện thoại" });
  }

  try {
    // Tìm thông tin cơ bản của thành viên
    const member = await Member.findOne({ phone }).populate("tier").lean();
    if (!member) {
      return res.status(404).json({ success: false, message: "Không tìm thấy khách hàng" });
    }

    const currentMinPoints = (member.tier as any)?.min_points || 0;

    //  Dùng Promise.all để lấy tất cả data liên quan đồng thời
    const [
      availableVouchers,
      nextTier,
      ownedVouchers,
      pointHistory
    ] = await Promise.all([
      // Lấy voucher họ CÓ THỂ ĐỔI
      Voucher.find({
        status: "active",
        pointsRequired: { $lte: member.redeemablePoints },
        remainingQuantity: { $gt: 0 },
        validTo: { $gte: new Date() }
      }).sort({ pointsRequired: 1 }).lean(),
      
      // Lấy hạng tiếp theo
      Tier.findOne({
        min_points: { $gt: currentMinPoints }
      }).sort({ min_points: 1 }).lean(),
      
      // Lấy voucher họ ĐÃ SỞ HỮU (chưa sử dụng)
      Redemption.find({ 
        memberId: member._id,
        status: "redeemed" // Chỉ lấy voucher 'đã đổi' (chưa dùng)
      }).populate('voucherId').sort({ createdAt: -1 }).lean(),
      
      // Lấy lịch sử điểm (10 giao dịch gần nhất)
      PointTransaction.find({ memberId: member._id })
        .sort({ createdAt: -1 })
        .limit(10)
        .lean()
    ]);

    //  Trả về dữ liệu tổng hợp
    res.status(200).json({
      success: true,
      data: {
        // Thông tin thành viên
        memberInfo: {
          _id: member._id,
          name: member.name,
          phone: member.phone,
          redeemablePoints: member.redeemablePoints,
          totalPoints: member.totalPoints,
          tier: (member.tier as any)?.name || "Chưa có hạng"
        },
        // Hạng tiếp theo
        nextTierInfo: nextTier ? {
          name: nextTier.name,
          pointsNeeded: nextTier.min_points - member.totalPoints
        } : null,
        // Phần thưởng họ CÓ THỂ đổi
        availableVouchers: availableVouchers,
        // Voucher họ ĐÃ SỞ HỮU
        ownedVouchers: ownedVouchers,
        // Lịch sử điểm
        pointHistory: pointHistory
      }
    });

  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || "Lỗi hệ thống" });
  }
};

 //[POST] /api/public/staff/earn
export const staffEarnpoints = async (req: Request, res: Response) => {
    const { phone, amount } = req.body;
    if (!phone || !amount) {
        return res.status(400).json({ message: "Bạn chưa nhập SĐT hoặc số tiền (amount)" });
    }
    if (amount <= 0) { 
        return res.status(400).json({ message: "Số tiền (amount) phải lớn hơn 0" });
    }

    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const member = await Member.findOne({ phone: phone }).session(session);
        if (!member) {
            await session.abortTransaction();
            session.endSession();
            return res.status(404).json({ message: "Không tìm thấy khách hàng" });
        }
        // (member, amount, session, orderId, source)
        const { points } = await LoyaltyService.earnPoints(
            member,
            amount,
            session,
            null, 
            "staff_entry" 
        );

        if (points <= 0) {
             await session.abortTransaction();
             session.endSession();
             return res.status(400).json({ message: "Số tiền không đủ để tích điểm." });
        }

        await member.save({ session });
        await session.commitTransaction();

        res.status(200).json({
            success: true,
            message: `Tích ${points} điểm thành công cho khách hàng ${member.name}`,
            data: {
                memberId: member._id,
                pointsEarned: points,
                redeemablePoints: member.redeemablePoints
            }
        });

    } catch (error: any) {
        await session.abortTransaction();
        return res.status(500).json({
            success: false,
            message: error.message || "Lỗi hệ thống"
        });
    } finally {
        await session.endSession();
    }
}

//[POST] /api/public/staff/redeem
export const staffRedeemVoucher = async (req:Request, res:Response) => {
  const { phone, voucherId } = req.body;

  if (!phone || !voucherId) {
    return res.status(400).json({ message: "Thiếu SĐT khách hàng hoặc voucherId" });
  }
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const member = await Member.findOne({ phone }).session(session);
    const voucher = await Voucher.findById(voucherId).session(session);

    if (!member){
        return res.status(400).json({message:'khong tim thay khach hang'})
    } 
    if (!voucher){
        return res.status(400).json({message:"khong tim thay phan thuong"})
    } 
    if (voucher.remainingQuantity <= 0){
        return res.status(400).json({message:"phan thuong da het"})
    }
    if (member.redeemablePoints < voucher.pointsRequired){
        return res.status(400).json({message:"khach hang khong du tim doi thuong"})
    }

    // Trừ điểm và số lượng
    member.redeemablePoints -= voucher.pointsRequired;
    voucher.remainingQuantity -= 1;

    // Sinh mã code
    let voucherCode;
    let isUnique = false;
    while (!isUnique) {
      voucherCode = "VC-" + crypto.randomBytes(4).toString("hex").toUpperCase();
      const existing = await Redemption.findOne({ voucherCode }).session(session);
      if (!existing) isUnique = true;
    }

    //  Tạo PointTransaction (log tiêu điểm)
    await PointTransaction.create(
      [{
        memberId: member._id,
        type: "spend",
        amount: -voucher.pointsRequired, // Tiêu điểm là số âm
        source: "staff_redeem", // Nguồn là 'nhân viên đổi'
        refId: voucher._id.toString(),
        description: `Đổi voucher: ${voucher.title} (thực hiện bởi nan vien})`
      }],
      { session }
    );

    //  Tạo Redemption (mã voucher của khách)
    const [redemption] = await Redemption.create(
      [{
        memberId: member._id,
        voucherId: voucher._id,
        voucherCode: voucherCode,
        pointsSpent: voucher.pointsRequired,
        status: "redeemed" // Trạng thái đã đổi (chưa dùng)
      }],
      { session }
    );

    // Lưu thay đổi
    await member.save({ session });
    await voucher.save({ session });
    
    // Commit
    await session.commitTransaction();

    //  Ghi log (tùy chọn)
    MessageLog.create({
      memberId: member._id,
      channel: "STAFF_PORTAL",
      payload: { voucherCode, voucherName: voucher.title, staff: "staff" },
      status: "completed"
    });

    // Trả về mã voucher để nhân viên đưa cho khách
    res.status(200).json({
      success: true,
      message: `Đổi voucher thành công cho khách hàng!`,
      data: redemption 
    });

  } catch (err: any) {
    await session.abortTransaction();
    res.status(500).json({ success: false, message: err.message });
  } finally {
    session.endSession();
  }
}
//[GET] /api/public/staff/history/:phone  xem lich su giao dich
export const getMemberHistory = async (req:Request,res:Response)=>{
    const {phone} = req.params;
    if(!phone){
        return res.status(400).json({message:"khong tim thay phone"})
    }
    try {
        const member = await Member.findOne({phone});
        if(!member){
            return res.status(400).json({message:"khong tim thay khach hang"})
        }
        const history = await PointTransaction.findOne({memberId: member._id})
        .sort({createdAt:-1})
        .lean();

        res.status(200).json({
            success:true,
            message:"lay lich su giao dich cua khach thanh cong"
        })
    } catch (error) {
        console.error("loi khi lay lich su giao dich cua khach",error);
        res.status(500).json({
            message:"loi he thong"
        })
    }
}
// [POST] api/public/staff/create/vouchers
export const createVoucher = async (req: Request, res: Response) => {
  try {
    const {
      title,
      description,
      pointsRequired,
      totalQuantity, 
      validFrom,
      validTo,
      status,
      benefit,
      value,
      minValue,
      maxDiscount
    } = req.body;
    if(!title || pointsRequired === undefined || totalQuantity === undefined){
        return res.status(400).json({
        success: false,
        message: "Vui lòng cung cấp đầy đủ: title, pointsRequired, và totalQuantity"
      });
    }
    const remainingQuantity = totalQuantity;
    if(validTo<new Date(validTo) && (validFrom ? new Date(validFrom) : new Date)){
        return res.status(400).json({ 
            success: false, 
            message: "Ngày hết hạn (validTo) không thể trước ngày bắt đầu (validFrom) hoặc ngày hiện tại." 
        });
    }
    const voucher = new Voucher({
      title,
      description,
      pointsRequired,
      totalQuantity,
      remainingQuantity, 
      validFrom,
      validTo,
      status,
      benefit,
      value,
      minValue,
      maxDiscount
    });
     await voucher.save();
    res.status(200).json({ success: true, data: voucher });
  } catch (err: any) {
    // res.status(500).json({ success: false, message: "loi he thong" });
  }
};

// [GET] api/public/staff/vouchers (da co phan trang)
export const getVouchers = async (req: Request, res: Response) => {
    const page = parseInt(req?.query.page as string) || 1;
    const limit = parseInt(req?.query.limit as string) || 10;
    const search = (req?.query.search as string) || "";

    const skip  = (page-1) * limit;

    let filter = {};
    if(search){
      const serchRegex = new RegExp(search,"i");
      filter = {
        $or:[
          {title:serchRegex},
        ]
      }
    }
      const [totalItem,voucher] = await Promise.all([
        Voucher.countDocuments(filter),
        Voucher.find(filter)
        .sort({createdAt:-1})
        .skip(skip)
        .limit(limit)
      ])
      const totalPage = Math.ceil(totalItem/limit);
        res.status(200).json({ 
          success: true, 
          data: voucher,
          pagination:{
            totalItem,
            totalPage,
            currentPage:page,
            limit
          }
        });
  try {
    const vouchers = await Voucher.find().sort({ createdAt: -1 });
    res.status(200).json({ success: true, data: vouchers });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};
//[GET] api/public/staff/get-vouchers/:id
export const GetVouchers = async (req:Request,res:Response)=>{
  try {
    const {id} = req.params;
    const data = await Voucher.findById(id);
    if(!data){
      return res.status(400).json({success:true,message:"khog co id voucher"});
    }
    return res.status(200).json({success:true,message:"lay voucher thanh cong"}) 
  } catch (error) {
    console.error("loi khi lay voucher",error);
    return res.status(500).json({success:false,message:"loi he thong"})
  }
}

// [PATCH] api/public/staff/edit/vouchers/:id
export const updateVoucher = async (req: Request, res: Response) => {
  try {
    const {id} = req.params;
    const updatePayload = req.body;
    if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ success: false, message: "ID voucher không hợp lệ" });
  }
  const currentVoucher = await Voucher.findById(id);
    if (!currentVoucher) {
      return res.status(404).json({ success: false, message: "Không tìm thấy Voucher" });
    }
    if (updatePayload.remainingQuantity !== undefined) {
        delete updatePayload.remainingQuantity; 
    }
    // Kiểm tra xem admin có thay đổi TỔNG số lượng không
    if (updatePayload.totalQuantity !== undefined) {
        const newTotal = parseInt(updatePayload.totalQuantity, 10);     
        if (isNaN(newTotal) || newTotal < 0) {
            return res.status(400).json({ success: false, message: "totalQuantity phải là một số dương" });
        }
        const quantityDelta = newTotal - currentVoucher.totalQuantity;
        updatePayload.remainingQuantity = Math.max(0, currentVoucher.remainingQuantity + quantityDelta);
    }
    const updatedVoucher = await Voucher.findByIdAndUpdate(
      id,
      { $set: updatePayload }, 
      {
        new: true, 
        runValidators: true 
      }
    );
    res.status(200).json({ success: true, data: updatedVoucher });  
  } catch (error) {
    console.error(error);
    res.status(500).json({
        success: false,
        message: "Lỗi hệ thống. Vui lòng thử lại sau."
    });
  }
};
// [DELETE] api/public/staff/deletee/vouchers/:id
export const deleteVoucher = async (req:Request,res:Response)=>{
    try {
        const voucher = await Voucher.findByIdAndDelete(req.params.id);
        if(!voucher){
            return res.status(404).json({success: false, message: "Không tìm thấy Voucher"});
        }
         res.status(200).json({ success: true, message:"xoa voucher thanh cong"});
    } catch (error) {
          res.status(500).json({ success: false, message: "loi he thong" });
    }
}