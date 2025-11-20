import { Request, Response } from "express";
import mongoose from "mongoose";
import AffiliateTier from "../../Model/affiliateTier";
import AffiliateOrder from "../../Model/affiliateOrder";
import Affiliate from "../../Model/affiliate";

// --- AFFILIATE TIER (CẤP BẬC) MANAGEMENT ---
// [POST] /admin/affiliate/tiers
export const createAffiliateTier = async (req: Request, res: Response) => {
  try {
    const {name,commission_rate,min_sales} = req.body;
    if(commission_rate<0 || commission_rate>100){
      return res.status(400).json({message:"loi commission phai lon hon 0 den 100"});
    }
    if(min_sales<0){
      return res.status(400).json({message:" doanh so toi thieu phai lon hon 0"})
    }
    const existingName = await AffiliateTier.find({name:name});
    if(!existingName){
      return res.status(400).json({message:"ten Tier da ton tai"})
    }
    const tier = new AffiliateTier({name,commission_rate,min_sales});
    await tier.save();
    res.status(201).json({ success: true, data: tier });
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message });
  }
};

// [GET] /admin/affiliate/tiers
export const getAffiliateTiers = async (req: Request, res: Response) => {
  try {
     const query = req.query || {};
       const page = parseInt(query.page as string) || 1;
    const limit = parseInt(query.limit as string) || 10;
    const search = (query.search as string) || "";
    // const page = parseInt(req.query?.page as string) || 1;
    // const limit = parseInt(req.query?.limit as string) || 10;
    // const search = (req.query?.search as string) || "";
    const skip = (page-1)*limit;
    let filter:any = {};
    if(search){
      const searchRegex = new RegExp(search,"i");
      const orConditions:any[] = [{name:searchRegex}];
      if(!isNaN(Number(search))){
        orConditions.push({ min_sales: Number(search) })
      }
      // filter = {$or:[
      //   {name:searchRegex},
      //   {min_sales:searchRegex}
      // ]}
      filter = { $or: orConditions };
    }
    const [totalItems,tiers] = await Promise.all([
      AffiliateTier.countDocuments(filter),
      AffiliateTier.find(filter)
      .sort({min_sales:1})
      .skip(skip)
      .limit(limit)
    ])
    const totalPage = Math.ceil(totalItems/limit);
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
// [GET] /admin/affiliate/get-tiers/:id
export const getAffiliate = async (req:Request,res:Response)=>{
  try {
    const {id} = req.params;
    const data = await AffiliateTier.findById(id);
    if(!data){
      return res.status(400).json({message:"id nay khong hop le"});
    }
    return res.status(200).json({
      message:"lay hang thanh cong",
      data:data
    })
  } catch (error) {
    console.error("lay khong thanh cong:",error)
    return res.status(500).json({
      message:"lay hang khong thanh cong"
    })
  }
}

// [PATCH] /admin/affiliate/tiers/:id
export const updateAffiliateTier = async (req: Request, res: Response) => {
  try {
    const {id} = req.params;
    const data = req.body;
    if(data.commission_rate !== undefined && (data.commission_rate<0 || data.commission_rate>100)){
      return res.status(400).json({message:"hoa hong khong hop le"})
    }
    const tier = await AffiliateTier.findByIdAndUpdate(id,data, { new: true });
    if (!tier) return res.status(404).json({ success: false, message: "Không tìm thấy Hạng" });
    res.status(200).json({ success: true, data: tier });
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message });
  }
};
//[DELETE] /admin/affiliate/delete-tiers/:id
export const deleteAffiliateTier = async (req:Request,res:Response)=>{
  try {
    const {id} = req.params;
    const data = await AffiliateTier.findByIdAndDelete(id);
    if(!data){
      return res.status(400).json({message:"khong tim thay id"});
    }
    return res.status(200).json({message:"xoa khong thanh cong"});
    
  } catch (error) {
     res.status(400).json({ success: false, message: error.message });
  }
}

// --- AFFILIATE ORDER (DUYỆT HOA HỒNG) MANAGEMENT ---

// [GET] /admin/affiliate/orders
// Lấy danh sách hoa hồng, lọc theo trạng thái (pending, paid, canceled)
export const getAffiliateOrders = async (req: Request, res: Response) => {
  try {
    const { status } = req.query; // ?status=pending
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const search = req.body.search;
    const skip = (page-1)*limit;
    let filter:any = {};
    if (status) {
      filter.status = status;
    }
    if(search){
      const serchRegex = new RegExp(search,"i");
      filter = {$or:[
        {status:serchRegex}
      ]}
    }
    const [totalItems , orders] = await Promise.all([
      AffiliateOrder.countDocuments(filter),
      AffiliateOrder.find(filter)
      .populate('affiliate','name email')
      .populate('order','total_amount')
      .sort({createdAt:-1})
      .skip(skip)
      .limit(limit)
    ])
    const totalPage = Math.ceil(totalItems/limit);
    res.status(200).json({ 
      success: true, 
      data: orders,
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