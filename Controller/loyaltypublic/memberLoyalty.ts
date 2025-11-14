import { Request, Response, NextFunction } from "express";
import Member from "../../Model/member";
import Redemption from "../../Model/redemption";
import PointTransaction from "../../Model/pointTransaction";


// [GET] api/public/loyalty/:phone
export const GetMember = async (req:Request,res:Response)=>{
    try {
        const {phone} = req.params;
    if(!phone){
        return res.status(400).json({message:"yeu cau nhap so dien thoai"})
    }

    const findMember = await Member.findOne({phone:phone}).populate("tier").lean();
    if(!findMember){
        return res.status(400).json({message:"khong tim thay member"});
    }
    // voucher khach hang co the su dung
    const availableVouchers = await await Redemption.find({memberId:findMember._id})
            .populate("voucherId")
            .sort({createdAt:-1});
    // lich su doi diem
    const history = await PointTransaction.find({memberId:findMember._id})
    .sort({createdAt:-1})
    .limit(20)
    .lean();

    return res.status(200).json({
        success:true,
        message:"lay thong tin khach thanh cong",
        data:{
            memberInfo:{
                name:findMember.name,
                phone:findMember.phone,
                redeemablePoints:findMember.redeemablePoints,
                tier: (findMember.tier as any)?.name || "Chưa có hạng"
            },
            availableVouchers:availableVouchers,
            PointTransactionHistory:history
        }
    })      
    } catch (error) {
        console.error("loi khi lay member",error);
        return res.status(500).json({message:"loi he thong"})
    }
}