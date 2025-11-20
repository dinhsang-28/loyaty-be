
import { Router } from "express";

import * as controller from "../../Controller/loyaltypublic/memberLoyalty";

const router = Router();

router.get("/loyalty/:phone", controller.GetMember);

export default router;