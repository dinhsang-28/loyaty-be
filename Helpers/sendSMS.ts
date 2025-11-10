import twilio from "twilio";
export interface SMSOption {
    to: string,
    message: string
}

export const sendSMS = async ({ to, message }: SMSOption) => {
    try {
        const client = twilio(
            process.env.TWILIO_ACCOUNT_SID,
            process.env.TWILIO_AUTH_TOKEN
        )
         const msg = client.messages.create({
            body:message,
            from:process.env.TWILIO_PHONE_NUMBER,
            to
        })
        console.log("send SMS:",(await msg).sid)

    } catch (error) {
        console.log("SMS failed:",error.message)
    }
}

// dung Twilio , dinh dang +84 o dau , khong dung 0