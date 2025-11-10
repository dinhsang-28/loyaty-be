import nodemailer from"nodemailer"

export interface NotifyOptions {
  email?: string;
  phone?: string;
  subject: string;
  html: string;
}

const sendMail = async({email,subject,html}:NotifyOptions)=>{
    if (!email) {
    console.warn("Không có email để gửi thông báo");
    return;
  }
  try {
    const transport = nodemailer.createTransport({
        service:"gmail",
        auth:{
            user:process.env.EMAIL_USER,
            pass:process.env.EMAIL_PASSWORD
        }
    })
    const emailOption = {
        form:"buidinhsang2806@gmail.com",
        to:email,
        subject:subject,
        html:html
    }
    const info = await transport.sendMail(emailOption);
    console.log("Email sent:", info.response);
  } catch (error) {
     console.error("Gửi email lỗi:", error.message);
  }

}
export default sendMail;