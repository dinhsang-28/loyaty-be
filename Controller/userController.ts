import { Request, Response, NextFunction } from "express";
import User from "../Model/user";
import Member from "../Model/member";

export const getProfile = async (req: Request, res: Response) => {

    try {
        const userId = (req as any).user.memberId;

        const user = await Member.findOne(userId)
        if (!user) {
            return res.status(400).json({ message: "khong tim thay user" });
        }
            const profileData = {
            id: user._id,
            name: user.name , // fallback nếu chưa có name
            totalPoints: user.totalPoints || 0,
            tier: user.tier || "Bronze",
        }
        return res.status(200).json({data:profileData,message:"lay profile thanh cong"})

    } catch (error) {
        console.error("loi , khong lay duoc profile",error);
        return res.status(500).json({message:"loi he thong"})
    }

}