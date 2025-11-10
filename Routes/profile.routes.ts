// routes/order.routes.ts
import { Router } from "express";
import { auth, AuthRequest } from "../middleware/auth";
import * as controller from "../Controller/userController";

const router = Router();

router.get("/",auth, controller.getProfile);

export default router;