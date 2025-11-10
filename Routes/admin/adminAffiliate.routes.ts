// routes/admin/adminAffiliate.routes.ts
import { Router } from "express";
import * as controller from "../../Controller/admin/adminAffiliateController";

const router = Router();

// Affiliate Tiers (Cấp bậc CTV)
router.post("/tiers", controller.createAffiliateTier);
router.get("/tiers", controller.getAffiliateTiers);
router.patch("/tiers/:id", controller.updateAffiliateTier);

// Affiliate Orders (Duyệt hoa hồng)
router.get("/orders", controller.getAffiliateOrders);
router.patch("/orders/:id/approve", controller.approveAffiliateOrder);
router.patch("/orders/:id/cancel", controller.cancelAffiliateOrder);

export default router;