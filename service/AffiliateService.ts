// services/AffiliateService.ts
import mongoose from "mongoose";
import Affiliate from "../Model/affiliate";
import AffiliateTier from "../Model/affiliateTier";
import AffiliateOrder from "../Model/affiliateOrder";

export class AffiliateService {
  /**
   * Xử lý hoa hồng cho Affiliate từ một đơn hàng.
   * @param affiliateId ID của affiliate
   * @param order_amount Giá trị đơn hàng
   * @param orderId ID của đơn hàng
   * @param session Session của Mongoose transaction
   * @returns { affiliate, affiliateCommission }
   */
  public static async trackAffiliateCommission(
    affiliateId: string | undefined | null,
    order_amount: number,
    orderId: string, // Bắt buộc phải có orderId
    session: mongoose.ClientSession
  ) {
    if (!affiliateId) {
      return { affiliate: null, affiliateCommission: 0 };
    }

    // Tìm Affiliate
    const affiliate = await Affiliate.findById(affiliateId).session(session);
    console.log("affilite",affiliate);
    if (!affiliate) {
      console.warn(`Affiliate not found for ID: ${affiliateId}`);
      return { affiliate: null, affiliateCommission: 0 };
    }

    // 2. Tính hoa hồng dựa trên hạng
    //  const unitAmount = 1000
    const tier = await AffiliateTier.findById(affiliate.tier).session(session);
    const rate = (tier as any)?.commission_rate || 0.03; // Mặc định 3%
    console.log("data rate:",rate);
    // const basePoints = Math.floor(order_amount / unitAmount);
    // console.log("data basePoints:",basePoints);
     const affiliateCommission = order_amount * rate;
     console.log("data affiliateCommission:",affiliateCommission);
    // const affiliateCommission = order_amount * rate;

    if (affiliateCommission <= 0) {
      return { affiliate, affiliateCommission: 0 };
    }

    // 3. Ghi log AffiliateOrder (LIÊN KẾT VỚI ORDER)
    await AffiliateOrder.create(
      [
        {
          affiliate: affiliate._id,
          order: orderId, 
          order_value: order_amount,
          commission_amount: affiliateCommission,
          sale_amount:affiliateCommission,
          status: 'pending' 
        },
      ],
      { session }
    );

    // 4. Cập nhật tổng cho Affiliate
    // Tạm thời chưa cộng hoa hồng, chỉ cộng doanh số.
    // Hoa hồng sẽ được cộng khi AffiliateOrder chuyển sang 'paid'
    // console.log("number affiliate truoc:",affiliate.total_sales)
    // // affiliate.total_sales += affiliateCommission;
    // console.log("number affiliate sau:",affiliate.total_sales)
    // affiliate.total_commission += affiliateCommission; // Tạm thời KHÔNG cộng vội

    // 5. Kiểm tra nâng hạng Affiliate
    await this.updateAffiliateTier(affiliate, session);

    return { affiliate, affiliateCommission };
  }

  /**
   * Kiểm tra và cập nhật hạng cho affiliate dựa trên total_sales.
   */
  public static async updateAffiliateTier(
    affiliate: any,
    session: mongoose.ClientSession
  ) {
    const nextTier = await AffiliateTier.findOne({
      min_sales: { $lte: affiliate.total_sales },
    })
      .sort({ min_sales: -1 })
      .session(session);

    if (
      nextTier &&
      (!affiliate.tier || affiliate.tier.toString() !== nextTier._id.toString())
    ) {
      affiliate.tier = nextTier._id;
    }
  }
}