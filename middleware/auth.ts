import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import User from "../Model/user";
require('dotenv').config();
export interface AuthRequest extends Request {
  user?: {
    userId: string,
    memberId: string | null,
    affiliateId: string | null
  }
}

export const auth = async (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(200).json({ message: "Yeu cau xac thuc" })
  }
  const token = req.header('Authorization')?.split(' ')[1];
  if (!token) {
   return  res.json({
      status: 401,
      message: "truy cap bi tu choi , khong cung cap thong tin",
    })
  }
  try {
    const decode = jwt.verify(token, process.env.JWT_SECRET as string);
    const user = await User.findById(decode.userId);
    if (!user) return res.status(401).json({ message: "User không hợp lệ" });
    (req as any).user = {
      userId: user._id,
      memberId: user.memberProfile,
      affiliateId: user.affiliateProfile
    };
    next();
  } catch (error) {
   return  res.json({
      status: 403,
      message: "token khong hop le hoac da het han"
    })
  }
}
export const adminMiddleware = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    // console.log("req.user.userId:",req.user.userId)
    if (!req.user || !req.user.userId) {
      return res.status(403).json({ message: "chua duoc xac thuc" })
    }
    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(403).json({ message: "khong co nguoi dung" })
    }
    if(user.role!=="admin"){
      return res.status(403).json({message:"ban khong co quyen truy cap"})
    }
    next();
  } catch (error) {
    console.error("Admin middleware error:", error);
    res.status(500).json({ message: "loi may chu" });
  }
}