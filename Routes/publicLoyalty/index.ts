import { Express } from "express";

import getMemberPublic from "./member"
import getStaffPublic from "./staff";
const indexRoutesPublicLoyalty = (app:Express):void=>{

//public
app.use("/api/public",getMemberPublic);
//api/public/staff
app.use("/api/public/staff",getStaffPublic);

}
export default indexRoutesPublicLoyalty;