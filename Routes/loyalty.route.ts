// routes/loyalty.routes.ts
import { Router } from "express";
import { auth, AuthRequest } from "../middleware/auth";
import { 
  getProfile, 
  checkRewards, 
  redeemVoucher ,
  getOrder,
  myVoucher
} from "../Controller/loyalty";

const router = Router();

// Mọi route trong file này đều yêu cầu đăng nhập
router.use((req, res, next) => auth(req as AuthRequest, res, next));

// [GET] /api/loyalty/profile
router.get("/profile", getProfile);

// [POST] /api/loyalty/check-rewards
router.post("/check-rewards", checkRewards);

// [POST] /api/loyalty/redeem
router.post("/redeem", redeemVoucher);

// [GET] /api/loyalty/order
router.get("/order",getOrder)

// [GET] /api/loyalty/my-voucher
router.get("/my-voucher",myVoucher)
export default router;