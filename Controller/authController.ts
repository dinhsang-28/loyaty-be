import { Request, Response, NextFunction } from "express";
import mongoose from "mongoose";
import bcrypt from "bcrypt";
import * as jwt from "jsonwebtoken";
import crypto from "crypto";
import User from "../Model/user";
import Member from "../Model/member";
import Affiliate from "../Model/affiliate";
import Tier from "../Model/Tier";
import AffiliateTier from "../Model/affiliateTier";
import MessageLog from "../Model/messageLog";

const JWT_SECRET = process.env.JWT_SECRET||"cd65d522e67598e0f177b053602c9ef88d85b1a5fb8cba63475e478fa1b363160b327db1";
//[post] /auth/register
export const register = async (req: Request, res: Response) => {
    const { name, phone, email, password } = req.body;
    // console.log("data:",name,phone,email,password);
    if (!name || !phone || !email || !password) {
        return res.status(400).json({ message: "thieu name , phone , email , password" });
    }
    const session = await mongoose.startSession();
    try {
        session.startTransaction();
        const existingUser = await User.findOne({ $or: [{ phone }, { email }],}).session(session);
        if (existingUser) {
            return res.status(400).json({ message: "So dien thoai hoac email da dang ki" });
        }
        const existingMember = await Member.findOne({ phone }).session(session);
        if (existingMember) {
            return res.status(400).json({ message: "so dien thoai da ton tai" });
        }
        const hashPass = await bcrypt.hash(password, 12);
        const user = new User({
            phone: phone,
            email: email,
            password: hashPass
        })
        await user.save({ session });

        const defaultTier = await Tier.findOne({ min_points: 0 }).session(session);
        const [newMember] = await Member.create([{
            user: user._id,
            name,
            phone,
            tier: defaultTier || null,
            totalPoints: 100,
            redeemablePoints: 100,
            source: "ZALO_REGISTER"
        }], { session });
        user.memberProfile = newMember._id;
        await user.save({session});
        await session.commitTransaction();
        MessageLog.create({
            memberId: newMember._id,
            channel: "ZALO_OA",
            payload: { message: "Chào mừng thành viên mới" },
            status: "queued"
        });

        res.status(201).json({
            success: true,
            message: "Đăng ký thành công",
            userId: newMember._id,
            memberId: newMember._id
        });

    } catch (error) {
        await session.abortTransaction();
        res.status(500).json({ success: false, message: error.message });
    }
    finally {
        await session.endSession();
    }
}

//[POST] auth/login

export const login = async (req: Request, res: Response) => {
    try {
        const { phone, password } = req.body
        if (!phone || !password) {
            return res.status(400).json({ message: "chua nhap phone or password" });
        }
        const user = await User.findOne({ phone });
        if (!user) {
            return res.status(400).json({ message: "khong tim thay nguoi dung" });
        }
        const comparePassword = await bcrypt.compare(password, user.password);
        if (!comparePassword) {
            return res.status(400).json({ message: "Mat khau khong dung" });
        }
        const payload = {
            userId: user._id,
            memberId: user.memberProfile,
            affiliateId: user.affiliateProfile,
            isAdmin:user.role === "admin",
            isAffiliate:!!user.affiliateProfile
        }
        const token = jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" });
        res.status(200).json({
            success: true,
            token,
            data: payload
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
}

//[POST] /auth/register-affiliate (Người dùng đã đăng nhập)

export const resgisterAffiliate = async (req: Request, res: Response) => {
    const userId = (req as any).user?.userId;
    if (!userId) {
        return res.status(401).json({ message: "Cần đăng nhập" });
    }
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const user = await User.findById(userId).session(session);
        if (!user) {
            return res.status(400).json({ message: "khong co nguoi dung" });
        }
        if (user.affiliateProfile) {
            return res.status(400).json({ message: "ban da la affiliate" });
        }
        let referral_code;
        let unique = false;
        while (!unique) {
            referral_code = "AFF-" + crypto.randomBytes(3).toString("hex").toUpperCase();
            const existingCode = await Affiliate.findOne({ referral_code }).session(session);
            if (!existingCode) unique = true;
        }
        // lay hang affiliate thap nhat
        const defaultTier = await AffiliateTier.findOne({ min_sales: 0 }).session(session);
        const member = await Member.findById(user.memberProfile).session(session);
        // Tạo Hồ sơ Affiliate
        const [newAffiliate] = await Affiliate.create(
            [{
                user: user._id,
                name: member?.name || "Affiliate User",
                phone: user.phone || member?.phone,
                email: user.email,
                referral_code,
                tier: defaultTier?._id || null
            }],
            { session }
        );
        const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
        const referralCode = `${frontendUrl}/track?ref=${referral_code}`;
        user.affiliateProfile = newAffiliate._id;
        await user.save({ session });
        await session.commitTransaction()
        res.status(201).json({
            success: true,
            message: "Đăng ký affiliate thành công",
            data: newAffiliate,
            referralCode:referralCode
        });
    } catch (error) {
        await session.abortTransaction();
        res.status(500).json({ success: false, message: error.message });
    }
    finally {
        session.endSession();
    }
}
