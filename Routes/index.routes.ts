import { Express } from "express";
import authRoutes from "./auth.route";
import loyaltyRoutes from "./loyalty.route";
import affiliateRoutes from "./affiliate.routes";
import orderRoutes from "./order.routes";
import profileRoutes from "./profile.routes";
import publicRoutes from "./public.routes";
import getMemberPublic from "./publicLoyalty/member"
const indexRoutes = (app:Express):void=>{
app.use("/", publicRoutes); // /track
app.use("/api/auth", authRoutes); // /api/auth/login
//public
app.use("/api/public",getMemberPublic);

// --- CÁC ROUTE CẦN ĐĂNG NHẬP (USER) ---
app.use("/api/profile",profileRoutes );
app.use("/api/loyalty", loyaltyRoutes);
app.use("/api/affiliate", affiliateRoutes);
app.use("/api/orders", orderRoutes);
}
export default indexRoutes;