import { Request, Response } from "express";
import mongoose from "mongoose";
import Payout from "../../Model/payout";
import Affiliate from "../../Model/affiliate";
import sendMail from "../../Helpers/sendMail"; 

// [GET] /admin/payouts
export const getPayouts = async (req:Request,res:Response)=>{
  try {
     const data = await Payout.find().populate("affiliate");
     if(!data){
      return res.status(400).json({message:"khong co payout"})
     }
     return res.status(200).json({
      data:data,
      message:"lay payout thanh cong"
     })
    
  } catch (error) {
    console.error("khong lay duoc payout",error);
    return res.status(500).json({
      message:"loi he thong"
    })
  }
}
/**
 * [PATCH] /admin/payouts/:payoutId/status
 * Admin duyệt hoặc từ chối một yêu cầu rút tiền
 */
export const updatePayoutStatus = async (req: Request, res: Response) => {
  const { payoutId } = req.params;
  const { status } = req.body; // 'approved' hoặc 'rejected'

  if (!["approved", "rejected"].includes(status)) {
    return res.status(400).json({ 
      success: false, 
      message: "Trạng thái không hợp lệ" 
    });
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  let payout: any;
  let affiliate: any;

  try {
    payout = await Payout.findById(payoutId).session(session);
    if (!payout) throw new Error("Không tìm thấy yêu cầu rút tiền");
    if (payout.status !== "requested") throw new Error("Yêu cầu này đã được xử lý");

    payout.status = status;

    // Nếu admin từ chối (rejected)
    if (status === "rejected") {
      // Tìm affiliate và hoàn lại tiền vào số dư hoa hồng
      affiliate = await Affiliate.findById(payout.affiliate).session(session);
      if (affiliate) {
        // Hoàn lại tiền vào số dư có thể rút
        affiliate.total_commission += payout.amount;
        await affiliate.save({ session });
      }
    }

    // Lưu trạng thái mới của payout
    await payout.save({ session });
    await session.commitTransaction();

    // Gửi email thông báo (bất đồng bộ)
    try {
      if (!affiliate) {
         affiliate = await Affiliate.findById(payout.affiliate);
      }
      
      if (affiliate?.email) {
        const emailSubject = status === "approved"
            ? "Yêu cầu rút tiền của bạn đã được duyệt"
            : "Yêu cầu rút tiền của bạn bị từ chối";

        const emailBody = status === "approved"
            ? `<p>Xin chào <b>${affiliate.name}</b>,</p><p>Yêu cầu rút tiền <b>${payout.amount.toLocaleString()}đ</b> của bạn đã được <b>duyệt</b>.</p><p>Hệ thống sẽ tiến hành thanh toán sớm nhất.</p>`
            : `<p>Xin chào <b>${affiliate.name}</b>,</p><p>Rất tiếc, yêu cầu rút tiền <b>${payout.amount.toLocaleString()}đ</b> của bạn đã bị <b>từ chối</b>.</p><p>Số tiền ${payout.amount.toLocaleString()}đ đã được hoàn lại vào số dư hoa hồng của bạn.</p>`;
        
        await sendMail({
          email: affiliate.email,
          subject: emailSubject,
          html: emailBody,
        });
      }
    } catch (emailErr: any) {
        console.error("Lỗi gửi mail Payout:", emailErr.message);
    }

    return res.status(200).json({
      success: true,
      message: `Yêu cầu rút tiền đã được ${status}`,
      data: payout,
    });

  } catch (err: any) {
    await session.abortTransaction();
    return res.status(500).json({ success: false, message: err.message });
  } finally {
    session.endSession();
  }
};

/**
 * [PATCH] /admin/payouts/:payoutId/paid
 * Admin đánh dấu một yêu cầu "approved" là đã thanh toán
 */
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