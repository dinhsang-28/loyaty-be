import express, { Express, Request, Response } from "express";
import indexRoutes from "./Routes/index.routes";
import indexAdminRoutes from"./Routes/admin/index.routes";
import "dotenv/config";
import bodyParser from "body-parser";
import cors from "cors";
import cookieParser from "cookie-parser";
import * as database from "./config/database";
import axios from "axios";

database.connect();

const app: Express = express();
const port: number = Number(process.env.PORT) || 3000;
app.use(express.json());

//  Body parser
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

//  CORS đầy đủ cho mọi loại request (đặc biệt là POST/OPTIONS)
app.use(
  cors({
    origin: "*",
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);
// app.options("(.*)", cors());

//  Cookie Parser
app.use(cookieParser());

//  Routes gốc
indexRoutes(app);
// Routes admin
indexAdminRoutes(app);
// start local
app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})

//  Kiểm tra route test nhanh
app.post("/test-post", (req, res) => {
  console.log("📩 Nhận POST từ React:", req.body);
  res.json({ message: "POST thành công", data: req.body });
});

//  Start server
// app.listen(port, async () => {
//   console.log(` Server listening on http://localhost:${port}`);

//   try {
//     //  Import động tunnelmole (vì đây là ESM module)
//     const tunnelmoleModule: any = await import("tunnelmole");
//     console.log(" Tunnelmole module loaded:", Object.keys(tunnelmoleModule));

//     // Một số bản export khác nhau → thử lần lượt
//     const tmCandidates = [
//       tunnelmoleModule?.tunnelmole,
//       tunnelmoleModule?.default,
//       tunnelmoleModule,
//     ].filter(Boolean);

//     let tunnelUrl: string | null = null;

//     for (const tm of tmCandidates) {
//       console.log("🔍 Kiểm tra export:", typeof tm);

//       try {
//         if (typeof tm?.open === "function") {
//           console.log(" Using tm.open()");
//           tunnelUrl = await tm.open({ port });
//           break;
//         }

//         if (typeof tm === "function") {
//           console.log("Using tm() directly");
//           tunnelUrl = await tm({ port });
//           break;
//         }

//         if (typeof tm?.connect === "function") {
//           console.log(" Using tm.connect()");
//           tunnelUrl = await tm.connect({ port });
//           break;
//         }
//       } catch (innerErr) {
//         console.warn(" Lỗi khi thử cách này:", (innerErr as any).message);
//       }
//     }

//     if (!tunnelUrl) throw new Error("Không tìm thấy hàm hợp lệ trong tunnelmole");

//     (global as any).__TUNNEL_URL = tunnelUrl;

//     console.log(` Public URL: ${tunnelUrl}`);
//     console.log(` Bạn có thể fetch từ React: ${tunnelUrl}/products`);
//     console.log(` Test POST: ${tunnelUrl}/test-post`);
//   } catch (err: any) {
//     console.error(" Tunnelmole failed:", err?.message);
//   }
// });
