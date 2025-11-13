
import { Request } from "express";
import Affiliate from "../Model/affiliate";
import AffiliateOrder from "../Model/affiliateOrder";

/**
 * Xử lý hoa hồng affiliate sau khi đơn hàng thành công.
 * Hàm này nên được gọi BÊN TRONG hàm xử lý đơn hàng thành công.
 * @param order - Đối tượng đơn hàng vừa được tạo (chứa order._id, order.total_amount)
 * @param req - Đối tượng Request (để lấy cookie)
 */
export const trackAffiliateOrder = async (order: any, req: Request) => {
    try {
        // 1. Đọc cookie 'affiliate_ref' từ request
        const refCode = req.cookies["affiliate_ref"];

        if (!refCode) {
            console.log("Không có cookie affiliate, bỏ qua.");
            return; // Không có cookie, không phải đơn hàng affiliate
        }

        // 2. Tìm affiliate và tier của họ
        const affiliate = await Affiliate.findOne({ referral_code: refCode }).populate("tier");

        if (!affiliate) {
            console.log(`Cookie ref ${refCode} không hợp lệ.`);
            return; // Mã giới thiệu không tồn tại
        }

        // 3. Tính hoa hồng
        let commission_rate = 0.05; // Mặc định 5% nếu không có tier
        if (affiliate.tier) {
            // Giả sử model AffiliateTier có trường 'commission_rate' (ví dụ: 0.05, 0.07, 0.1)
            commission_rate = (affiliate.tier as any).commission_rate || 0.05;
        }

        const commission_earned = order.total_amount * commission_rate;

        // 4. Tạo bản ghi AffiliateOrder
        await AffiliateOrder.create({
            affiliate: affiliate._id,
            order: order._id,
            order_amount: order.total_amount,
            commission: commission_earned,
            status: "pending", // Trạng thái chờ (ví dụ: chờ 30 ngày để chống hoàn tiền)
        });

        // 5. Cộng tiền hoa hồng (chưa duyệt) vào tài khoản affiliate
        // Tùy bạn: Có thể cộng vào total_commission ngay,
        // hoặc tạo 1 trường 'pending_commission'
        // Ở đây, ta cộng luôn vào 'total_commission' như code gốc của bạn
        affiliate.total_commission += commission_earned;
        await affiliate.save();

        console.log(`Đã ghi nhận hoa hồng ${commission_earned} cho affiliate ${affiliate.name}`);

        // (Tùy chọn) Xóa cookie sau khi đã ghi nhận
        // res.clearCookie("affiliate_ref"); // Cần truyền 'res' vào hàm này nếu muốn xóa

    } catch (err: any) {
        console.error("Lỗi nghiêm trọng khi xử lý hoa hồng affiliate:", err.message);
        // Quan trọng: Không để lỗi này làm hỏng flow thanh toán chính
    }
};

// -----
// Ví dụ cách gọi hàm này trong Controller đơn hàng của bạn:
/*
import { trackAffiliateOrder } from "../helpers/affiliateTracker";

export const handleSuccessfulPayment = async (req: Request, res: Response) => {
  try {
    // ... logic tạo đơn hàng (order) của bạn ...
    const newOrder = await Order.create({ ... });

    // *** GỌI HÀM TRACKING AFFILIATE TẠI ĐÂY ***
    await trackAffiliateOrder(newOrder, req);

    // ... logic còn lại (gửi mail cho khách, v.v.) ...
    return res.status(201).json({ success: true, data: newOrder });

  } catch (err) {
     return res.status(500).json({ success: false, message: err.message });
  }
}
// */