// routes/auth.routes.ts
import { Router } from "express";
import { register, login, resgisterAffiliate} from "../Controller/authController";
import { auth, AuthRequest } from "../middleware/auth";

const router = Router();

// [POST] /api/auth/register
router.post("/register", register);

// [POST] /api/auth/login
router.post("/login", login);

// [POST] /api/auth/register-affiliate (Yêu cầu đăng nhập)
router.post(
  "/register-affiliate", 
  (req, res, next) => auth(req as AuthRequest, res, next), 
  resgisterAffiliate
);

export default router;