import { Request, Response, NextFunction } from "express";
import mongoose from "mongoose";
import crypto from "crypto";
import Member from "../Model/member";
import Tier from "../Model/Tier";
import Voucher from "../Model/voucher";
import Redemption from "../Model/redemption";
import PointTransaction from "../Model/pointTransaction";
import MessageLog from "../Model/messageLog";
import Order from "../Model/order";
import User from "../Model/user";
// import { sendZaloMessage } from "../helpers/zalo";

// [GET] /loyalty/profile (Yêu cầu đăng nhập Member,lấy danh sách member)
export const getProfile = async (req: Request, res: Response) => {
  const memberId = (req as any).user?.memberId;
  if (!memberId) return res.status(401).json({ message: "Yêu cầu đăng nhập" });

  try {
    const member = await Member.findById(memberId).populate("tier");
    if (!member) return res.status(404).json({ message: "Không tìm thấy hồ sơ" });
    res.status(200).json({ success: true, data: member });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};
//[PATCH] /loyalty/edit/:id  (id member)
export const EditProfile = async(req:Request,res:Response)=>{
  const {id} = req.params; 
  if(!id){
    return res.status(401).json({message:"ban khong co quyen truy cap"})
  }
  const {name,phone,email} = req.body;
  const session = await mongoose.startSession();
  try {
    const editMember = await Member.findById(id).session(session);
    const editUser = await User.findById(editMember.user).session(session);
    if(phone && phone !== editMember.phone){
      const phoneExits = await User.findOne({phone,_id:{$ne:editUser._id}}).session(session)
      if(phoneExits){
        return res.status(400).json({message:"phone da ton tai"})
      }
    }
    editMember.phone=phone;
    editUser.phone=phone
    if(email && email!==editUser.email){
      const emailExits = await User.findById({email,_id:{$ne:editMember._id}}).session(session);
      if(emailExits){
        return res.status(400).json({message:"Email da ton tai"})
      }
    }
    editUser.email=email;
    if(name){
      editMember.name=name
    }
    await editMember.save({session});
    await editUser.save({session});
    await session.commitTransaction();
    return res.status(200).json({
      success:true,
      message:"Doi Profile thanh cong"
    })
    
  } catch (error) {
     await session.abortTransaction();
     return res.status(500).json({
      success:false,
      message:"loi he thong"
     })
  }
  finally{
    await session.endSession();
  }
}

// [POST] /loyalty/check-rewards (Yêu cầu đăng nhập Member,kiểm tra đổi thưởng)
export const checkRewards = async (req: Request, res: Response) => {
  const memberId = (req as any).user?.memberId;
  if (!memberId) return res.status(401).json({ message: "Yêu cầu đăng nhập" });
  try {
    const member = (await Member.findById(memberId).populate("tier"));
    if (!member) return res.status(404).json({ message: "Không tìm thấy hồ sơ" });

    // Tìm các voucher mà member ĐỦ ĐIỂM ĐỔI và CÒN HÀNG
    const availableVouchers = await Voucher.find({
      status: "active",
      pointsRequired: { $lte: member.redeemablePoints },
      remainingQuantity: { $gt: 0 },
      validTo: { $gte: new Date() } // Chỉ lấy voucher còn hạn
    })
      .sort({ pointsRequired: 1 })
      .lean();

    // Tìm hạng tiếp theo
    const currentMinPoints = (member.tier as any)?.min_points || 0;
    const nextTier = await Tier.findOne({
      min_points: { $gt: currentMinPoints }
    }).sort({ min_points: 1 });

    res.status(200).json({
      success: true,
      data: {
        member: {
          name: member.name,
          tier: (member.tier as any)?.name || "Chưa có hạng",
          redeemablePoints: member.redeemablePoints,
          totalPoints: member.totalPoints
        },
        nextTier: nextTier ? {
          name: nextTier.name,
          pointsNeeded: nextTier.min_points - member.totalPoints
        } : null,
        rewards: availableVouchers
      }
    });

  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// [POST] /loyalty/redeem (Yêu cầu đăng nhập Member,đổi thưởng)
export const redeemVoucher = async (req: Request, res: Response) => {
  const memberId = (req as any).user?.memberId;
  const { voucherId } = req.body;

  if (!memberId) return res.status(401).json({ message: "Yêu cầu đăng nhập" });
  if (!voucherId) return res.status(400).json({ message: "Thiếu voucherId" });

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Lấy thông tin (khóa document)
    const member = await Member.findById(memberId).session(session);
    const voucher = await Voucher.findById(voucherId).session(session);

    // Kiểm tra
    if (!member) throw new Error("Không tìm thấy khách hàng");
    if (!voucher) throw new Error("Không tìm thấy phần thưởng");
    if (voucher.remainingQuantity <= 0) throw new Error("Phần thưởng đã hết");
    if (member.redeemablePoints < voucher.pointsRequired) throw new Error("Không đủ điểm");

    // Trừ điểm và số lượng
    member.redeemablePoints -= voucher.pointsRequired;
    voucher.remainingQuantity -= 1;

    // Sinh mã code
    let voucherCode;
    let isUnique = false;
    while (!isUnique) {
      voucherCode = "Z-" + crypto.randomBytes(4).toString("hex").toUpperCase();
      const existing = await Redemption.findOne({ voucherCode }).session(session);
      if (!existing) isUnique = true;
    }

    //  Tạo PointTransaction (log tiêu điểm)
    await PointTransaction.create(
      [{
        memberId: member._id,
        type: "spend",
        amount: -voucher.pointsRequired, // Tiêu điểm là số âm
        source: "redeem_voucher",
        refId: voucher._id.toString(),
        description: `Đổi voucher: ${voucher.title}`
      }],
      { session }
    );

    // Tạo Redemption (mã voucher của khách)
    const [redemption] = await Redemption.create(
      [{
        memberId: member._id,
        voucherId: voucher._id,
        voucherCode: voucherCode,
        pointsSpent: voucher.pointsRequired,
        status: "redeemed" // Trạng thái: đã đổi (chưa dùng)
      }],
      { session }
    );

    // Lưu thay đổi
    await member.save({ session });
    await voucher.save({ session });
    
    // Commit
    await session.commitTransaction();

    // Gửi tin Zalo (bất đồng bộ)
    // sendZaloMessage(member.phone, `Ban da doi thanh cong voucher ${voucher.title}. Ma cua ban la: ${voucherCode}`);
    MessageLog.create({
      memberId: member._id,
      channel: "ZNS",
      payload: { voucherCode, voucherName: voucher.title },
      status: "queued"
    });

    res.status(200).json({
      success: true,
      message: "Đổi voucher thành công!",
      data: redemption
    });

  } catch (err: any) {
    await session.abortTransaction();
    res.status(500).json({ success: false, message: err.message });
  } finally {
    session.endSession();
  }
};

// [POST] /loyalty/use-code (mã dùng tại quầy)
export const useRewardCode = async (req: Request, res: Response) => {
  const { code } = req.body;
  if (!code) return res.status(400).json({ message: "Thiếu mã code" });

  try {
    const redemption = await Redemption.findOne({ voucherCode: code });
    
    if (!redemption) return res.status(404).json({ message: "Mã không tồn tại" });
    if (redemption.status === 'used') return res.status(400).json({ message: "Mã đã được sử dụng" });
    if (redemption.status === 'expired') return res.status(400).json({ message: "Mã đã hết hạn" });

    redemption.status = "used";
    redemption.usedAt = new Date();
    await redemption.save();

    res.status(200).json({
      success: true,
      message: "Xác nhận dùng mã thành công",
      data: redemption
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};
// [GET] /loyalty/order  (lay nhung don hang da mua)
export const getOrder = async (req:Request,res:Response)=>{
  try {
    const memberId = (req as any).user.memberId;
  if(!memberId){
    return res.status(400).json({message:"chua dang nhap"});
  }
  const orders = await Order.find({
    customer:memberId,
  })
  .sort({createdAt:1})
  .lean(); 
  return res.status(200).json({
    message:"lay don hang da mua thanh cong",
    data:orders
  })
  } catch (error) {
    console.error("loi khong lay duoc don hang",error);
    return res.status(500).json({message:"loi he thong"});
  }
}

// [GET] /loyalty/my-vouchers (lay danh sach voucher da doi);
export const myVoucher = async (req:Request,res:Response)=>{
  try {
    const memberId = (req as any).user.memberId;
  if(!memberId){
    return res.status(400).json({message:"yeu cau can phai dang nhap"});
  }
  const myVouchers = await Redemption.find({memberId:memberId})
        .populate("voucherId")
        .sort({createdAt:-1});
      
  return res.status(200).json({message:"Lay voucher member thanh cong" ,
     data:myVouchers
    })
    
  } catch (error) {
    console.error("loi khong lay duoc don hang",error);
    return res.status(500).json({message:"loi he thong"});
  }
}