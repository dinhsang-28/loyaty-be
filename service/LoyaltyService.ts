// services/LoyaltyService.ts
import mongoose from "mongoose";
import Member from "../Model/member";
import Tier from "../Model/Tier";
import PointTransaction from "../Model/pointTransaction";
import MemberTierLog from "../Model/memberTierLog";

export class LoyaltyService {
  /**
   * Tính điểm, ghi log giao dịch, và cập nhật hạng cho khách hàng.
   * @param member Đối tượng member 
   * @param amount Số tiền của đơn hàng
   * @param session Session của Mongoose transaction
   * @param orderId (Tùy chọn) ID của đơn hàng để ghi log
   * @param source (Tùy chọn) Nguồn gốc điểm (vd: 'order_completed', 'admin_adjust')
   * @returns { points, txn }
   */
  public static async earnPoints(
    member: any,
    amount: number,
    session: mongoose.ClientSession,
    orderId?: string | null,
    source: string = "order_completed"
  ) {
    // Tìm hạng và tính tỷ lệ tích điểm
    const tier = await Tier.findById(member.tier).session(session);
    // Mặc định 1 điểm cho mỗi 10,000đ nếu không có tier
    const pointsPerUnit = 1; 
    const unitAmount = 10000; 

    // Nếu có tier và benefits, dùng tỷ lệ của tier
    // Ví dụ: tier.benefits.pointMultiplier = 1.2 (nhận 1.2 điểm)
    const multiplier = (tier as any)?.benefits?.pointMultiplier || 1;
    
    const basePoints = Math.floor(amount / unitAmount);
    const points = Math.floor(basePoints * multiplier);

    if (points <= 0) {
      return { points: 0, txn: null }; // Không có điểm
    }

    // Ghi log Giao dịch (PointTransaction)
    const description = orderId
      ? `Tích ${points} điểm từ đơn hàng ${orderId}`
      : `Tích ${points} điểm từ giao dịch ${amount}đ`;

    const [txn] = await PointTransaction.create(
      [
        {
          memberId: member._id,
          type: "earn",
          amount: points, // Điểm kiếm được là số dương
          source: source,
          refId: orderId || undefined,
          description
        },
      ],
      { session }
    );

    //Cập nhật điểm cho khách hàng
    member.redeemablePoints += points; // Điểm để tiêu
    member.totalPoints += points;      // Điểm để xét hạng
    member.lastActiveAt = new Date();

    //Kiểm tra và cập nhật hạng (LOGIC MỚI)
    await this.updateMemberTier(member, session);
    
    // Controller sẽ gọi .save()
    return { points, txn };
  }

  /**
   * Kiểm tra và cập nhật hạng cho khách hàng (MỚI)
   */
  public static async updateMemberTier(
    member: any,
    session: mongoose.ClientSession
  ) {
    // Lấy hạng cao nhất mà khách hàng đạt được với số điểm hiện tại
    const nextTier = await Tier.findOne({
      min_points: { $lte: member.totalPoints }, // Dùng totalPoints
    })
      .sort({ min_points: -1 }) // Lấy hạng cao nhất
      .session(session);

    if (
      nextTier &&
      (!member.tier || member.tier.toString() !== nextTier._id.toString())
    ) {
      const oldTierId = member.tier;
      
      // Ghi log việc lên hạng
      await MemberTierLog.create(
        [{
          memberId: member._id,
          oldTier: oldTierId,
          newTier: nextTier._id,
          reason: `Đạt ${member.totalPoints} điểm.`
        }],
        { session }
      );
      
      // Cập nhật hạng mới cho member
      member.tier = nextTier._id;
    }
  }
}