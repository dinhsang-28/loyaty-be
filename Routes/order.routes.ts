// routes/order.routes.ts
import { Router } from "express";
import { auth, AuthRequest } from "../middleware/auth";
import { createOrder } from "../Controller/orderController";

const router = Router();

// [POST] /api/orders
// (Xử lý thanh toán/Tạo đơn hàng mới)
router.post(
  "/", 
  (req, res, next) => auth(req as AuthRequest, res, next), 
  createOrder
);

export default router;