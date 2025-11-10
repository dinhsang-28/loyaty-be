// routes/public.routes.ts
import { Router } from "express";
import { 
  trackAffiliateClick, 
  getAffiliateStats 
} from "../Controller/affiliateController";

const router = Router();

// [GET] /track?ref=... (Track affiliate click)
router.get("/track", trackAffiliateClick);

// [GET] /stats/:referral_code (Xem stats, nếu bạn muốn công khai)
router.get("/status/:referral_code", getAffiliateStats);

export default router;