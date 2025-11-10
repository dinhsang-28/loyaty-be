// routes/admin/adminLoyalty.routes.ts
import { Router } from "express";
import * as controller from "../../Controller/admin/adminLoyaltyController";
import { useRewardCode } from "../../Controller/loyalty";

const router = Router();

// Tiers (Cấp bậc)
router.post("/tiers", controller.createTier);
router.get("/tiers", controller.getTiers);
router.patch("/tiers/:id", controller.updateTier);
router.delete("/tiers/:id", controller.deleteTier);

// Vouchers (Quà đổi)
router.post("/vouchers", controller.createVoucher);
router.get("/vouchers", controller.getVouchers);
router.patch("/vouchers/:id", controller.updateVoucher);

// Members (Thành viên)
router.get("/members", controller.getMembers);
router.post("/members/adjust-points", controller.adjustMemberPoints);

// Dùng code tại quầy (Admin/Cashier dùng)
router.post("/use-code", useRewardCode);

export default router;