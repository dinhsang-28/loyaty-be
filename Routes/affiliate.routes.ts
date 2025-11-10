// routes/affiliate.routes.ts
import { Router } from "express";
import { auth, AuthRequest } from "../middleware/auth";
import {
  getProfile,
  requestPayout,
  getPayoutHistory,
  getSummary
} from "../Controller/affiliateController";

const router = Router();

// Mọi route trong file này đều yêu cầu đăng nhập
router.use((req, res, next) => auth(req as AuthRequest, res, next));

// [GET] /api/affiliate/profile
router.get("/profile", getProfile);

// [POST] /api/affiliate/request-payout
router.post("/request-payout", requestPayout);

// [GET] /api/affiliate/payouts
router.get("/payouts", getPayoutHistory);

// [GET] /api/affiliate/summary
router.get("/summary", getSummary);

export default router;