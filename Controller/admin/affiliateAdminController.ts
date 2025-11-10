import { Request, Response } from "express";
import Affiliate from "../../Model/affiliate";
import Payout from "../../Model/payout";
import sendMail from "../../Helpers/sendMail";
import Redemption from "../../Model/redemption";
import { startSession } from "mongoose";
 // PATCH /admin/affiliate/payout/status/:payoutId
export const updatePayoutStatus = async (req: Request, res: Response) => {
  const { payoutId } = req.params;
  const { status } = req.body;

  if (!["approved", "rejected"].includes(status)) {
    return res.status(400).json({
      success: false,
      message: "Trạng thái không hợp lệ (chỉ được 'approved' hoặc 'rejected')",
    });
  }
  const session = await startSession();

  try {
    session.startTransaction();
    const payout = await Payout.findById(payoutId).populate("affiliate").session(session);
    if (!payout) {
      return res.status(404).json({ success: false, message: "Không tìm thấy yêu cầu rút tiền" });
    }

    if (payout.status !== "requested") {
      return res.status(400).json({ success: false, message: "Yêu cầu này đã được xử lý" });
    }

    payout.status = status;

    const affiliate = (await Affiliate.findById(payout.affiliate._id)).populated("user");
    // Nếu admin từ chối , hoàn lại hoa hồng cho affiliate
    if (status === "rejected" && payout.affiliate) {
      if (affiliate) {
        affiliate.total_commission += payout.amount;
        await affiliate.save({session});
      }
    }
    await payout.save({session});
    await session.commitTransaction();
    // Gửi email thông báo
    if (affiliate?.email) {
      const emailSubject =
        status === "approved"
          ? "Yêu cầu rút tiền của bạn đã được duyệt"
          : "Yêu cầu rút tiền của bạn bị từ chối";

      const emailBody =
        status === "approved"
          ? `
          <p>Xin chào <b>${affiliate.name}</b>,</p>
          <p>Yêu cầu rút tiền <b>${payout.amount.toLocaleString()}đ</b> của bạn đã được <b>duyệt</b>.</p>
          <p>Hệ thống sẽ tiến hành thanh toán sớm nhất.</p>
          <br/>
          <p>Trân trọng,</p>
          <p><b>Đội ngũ Đình Sang Affiliate</b></p>
        `
          : `
          <p>Xin chào <b>${affiliate.name}</b>,</p>
          <p>Rất tiếc, yêu cầu rút tiền <b>${payout.amount.toLocaleString()}đ</b> của bạn đã bị <b>từ chối</b>.</p>
          <p>Vui lòng kiểm tra lại thông tin hoặc liên hệ hỗ trợ.</p>
          <br/>
          <p>Trân trọng,</p>
          <p><b>Đội ngũ Đình Sang Affiliate</b></p>
        `;

      await sendMail({
        email: affiliate.email,
        subject: emailSubject,
        html: emailBody,
      });
    }

    return res.status(200).json({
      success: true,
      message: `Yêu cầu rút tiền đã được ${status === "approved" ? "duyệt" : "từ chối"}`,
      data: payout,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
  finally{
    session.endSession();
  }
};


 // PATCH /affiliate/payout/paid/:payoutId

export const markPayoutAsPaid = async (req: Request, res: Response) => {
  const { payoutId } = req.params;
  try {
    const payout = await Payout.findById(payoutId);
    if (!payout) {
      return res.status(404).json({ success: false, message: "Không tìm thấy yêu cầu rút tiền" });
    }

    if (payout.status !== "approved") {
      return res.status(400).json({
        success: false,
        message: "Chỉ có thể đánh dấu 'paid' khi yêu cầu đã được duyệt",
      });
    }

    payout.status = "paid";

    await payout.save();

    return res.status(200).json({
      success: true,
      message: "Đã đánh dấu là đã thanh toán",
      data: payout,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ham nay moi them chua co route
// [POST] /loyalty/redeem/useCode
// export const useRewardCode = async (req: Request, res: Response) => {
//   const { code } = req.body;

//   if (!code) return res.status(400).json({ success: false, message: "Thiếu mã code" });

//   const redemption = await Redemption.findOne({ code });
//   if (!redemption) return res.status(404).json({ success: false, message: "Không tìm thấy mã này" });
//   if (redemption.used)
//     return res.status(400).json({ success: false, message: "Mã này đã được sử dụng" });

//   redemption.used = true;
//   redemption.used_at = new Date();
//   await redemption.save();

//   return res.status(200).json({
//     success: true,
//     message: "Mã đã được xác nhận sử dụng thành công",
//     data: { code: redemption.code, reward: redemption.reward },
//   });
// };