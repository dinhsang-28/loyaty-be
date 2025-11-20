
import { Router } from "express";

import * as controller from "../../Controller/loyaltypublic/staffLoyalty";

const router = Router();
    // [GET] /api/public/staff/lookup/:phone
    router.get("/lookup/:phone",controller.staffLookupCustomer)

     //[POST] /api/public/staff/earn
     router.post("/earn",controller.staffEarnpoints)
      //[POST] /api/public/staff/redeem
      router.post("/redeem",controller.staffRedeemVoucher)

      //[GET] /api/public/staff/history/:phone  xem lich su giao dich
      router.get("/history/:phone",controller.getMemberHistory)

      // [GET] api/public/staff/vouchers
      router.get("/vouchers",controller.getVouchers)
      //[GET] api/public/staff/get-vouchers/:id
      router.get("/get-vouchers/:id",controller.GetVouchers)

      // [PATCH] api/public/staff/edit/vouchers/:id
      router.patch("/edit/vouchers/:id",controller.updateVoucher)

      // [DELETE] api/public/staff/delete/vouchers/:id
      router.delete("delete/vouchers/:id",controller.deleteVoucher)
export default router;