// controllers/admin/adminLoyaltyController.ts
import { Request, Response } from "express";
import Tier from "../../Model/Tier";
import Voucher from "../../Model/voucher";
import Member from "../../Model/member";
import PointTransaction from "../../Model/pointTransaction";
import mongoose from "mongoose";
import { LoyaltyService } from "../../service/LoyaltyService";
import { parse } from "path";
import { console } from "inspector/promises";

// --- TIER (CẤP BẬC) MEMBER ---

// [POST] /admin/loyalty/tiers
export const createTier = async (req: Request, res: Response) => {
  try {
    const { name, min_points, benefits } = req.body;
    if(min_points>0){
      return res.status(400).json({message:"diem gioi han phai lon hon 0"})
    }
    const existingName = await Tier.find({name:name});
    if(existingName){
      return res.status(400).json({message:"ten da ton tai"})
    }
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
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const search = (req?.query.search as string)||"";
    const skip = (page-1)*limit;
    let filter:any = {};
    if(search){
      const searchRegex = new RegExp(search,"i");
       filter = {
        $or:[
        {name:searchRegex},
       ]}
    }
      const [totalItems , tiers] = await Promise.all([
        Tier.countDocuments(filter),
        Tier.find(filter)
        .sort({min_points:1})
        .skip(skip)
        .limit(limit)
      ])
      const totalPage = Math.ceil(totalItems/limit);
    // const tiers = await Tier.find().sort({ min_points: 1 });
    res.status(200).json({ 
      success: true, 
      data: tiers,
      pagination:{
        totalItems,
        totalPage,
        currentPage:page,
        limit
      }
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};
// [GET] admin/loyalty/get-tiers/:id
export const GetTiers = async (req:Request,res:Response)=>{
  try {
    const {id} = req.params;
  const data = await Tier.findById(id);
  if(!data){
    return res.status(400).json({message:"Id khong ton tai"})
  }
  return res.status(200).json({message:"lay  thanh cong"})
  } catch (error) {
    console.error("loi khi lay Tier id",error);
    return res.status(500).json({message:"loi he thong"});
  }
}

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
    console.log("data id",req.params.id);
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
    try {
      // logic tìm kiếm, phân trang
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const search = (req?.query.search as string) || "";

    const skip  = (page-1) * limit;

    let filter:any = {};
    if(search){
      const serchRegex = new RegExp(search,"i");
      filter = {
        $or:[
          {name:serchRegex},
          {phone:serchRegex},
        ]
      }
    }
      const [totalItem,members] = await Promise.all([
        Member.countDocuments(filter),
        Member.find(filter)
        .populate('tier')
        .sort({createdAt:-1})
        .skip(skip)
        .limit(limit)
      ])
      const totalPage = Math.ceil(totalItem/limit);
        res.status(200).json({ 
          success: true, 
          data: members,
          pagination:{
            totalItem,
            totalPage,
            currentPage:page,
            limit
          }
        });
    } catch (err: any) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// [POST] /admin/loyalty/members/adjust-points
// Admin cộng/trừ điểm thủ công
export const adjustMemberPoints = async (req: Request, res: Response) => {
  const { memberId, amount, reason } = req.body;
  if (!memberId || !amount || !reason) {
    return res.status(400).json({ message: "Thiếu memberId, amount, hoặc reason" });
  }
  if(amount<0){
    return res.status(400).json({message:`amount khong duoc nho hon khong`})
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