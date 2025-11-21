// routes/admin/adminPayout.routes.ts
import { Router } from "express";
import * as controller from "../../Controller/admin/adminPayoutController";

const router = Router();

router.get("/",controller.getPayouts);
// Duyệt/Từ chối yêu cầu rút tiền
router.patch("/:payoutId/status", controller.updatePayoutStatus);

// Đánh dấu đã thanh toán
router.patch("/:payoutId/paid", controller.markPayoutAsPaid);

export default router;