import { Express } from "express";

import { auth, adminMiddleware } from "../../middleware/auth";
import adminLoyaltyRoutes from "./adminLoyalty.routes";
import adminAffiliateRoutes from "./adminAffiliate.routes";
import adminPayoutRoutes from "./adminPayout.routes";

const indexAdminRoutes = (app: Express): void => {
    app.use("/api/admin",auth,adminMiddleware);
    app.use("/api/admin/loyalty", adminLoyaltyRoutes);
    app.use("/api/admin/affiliate", adminAffiliateRoutes);
    app.use("/api/admin/payouts", adminPayoutRoutes);
}
export default indexAdminRoutes;