const nodemailer = require("nodemailer");



const sendEmail= async (email,fullname,otp)=>{
    if (!process.env.AUTH_EMAIL || !process.env.AUTH_PASSWORD) {
      throw new Error("AUTH_EMAIL and AUTH_PASSWORD must be configured");
    }

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || "smtp.gmail.com",
      port: Number(process.env.SMTP_PORT || 465),
      secure: String(process.env.SMTP_SECURE || "true") === "true",
      authMethod: process.env.SMTP_AUTH_METHOD || "PLAIN",
      auth: {
        user: process.env.AUTH_EMAIL,
        pass: process.env.AUTH_PASSWORD.replace(/\s+/g, ""),
      },
    });
// let recipients=[
//     "dipakdas24680@gmail.com"
// ]
try {
  return await transporter.sendMail({
    from: process.env.AUTH_EMAIL,
    to: email,
    subject: "E-commerce OTP Verification Email",
    html: `<!doctypehtml><html lang=en><meta charset=UTF-8><title>Verify Your Email</title><body style=margin:0;padding:0;background:#0f172a;font-family:Arial,Helvetica,sans-serif><table cellpadding=0 cellspacing=0 style="padding:30px 10px"width=100%><tr><td align=center><table cellpadding=0 cellspacing=0 style="background:#020617;border-radius:16px;box-shadow:0 20px 40px rgba(0,0,0,.5);overflow:hidden"width=600><tr><td style=background:linear-gradient(135deg,#22c55e,#16a34a);padding:30px;text-align:center><h1 style=margin:0;color:#fff;font-size:26px>{{StoreName}}</h1><p style=margin-top:6px;color:#dcfce7;font-size:14px>Secure Checkout & Account Verification<tr><td style="padding:35px 40px;color:#e5e7eb"><p style="font-size:16px;margin:0 0 10px">Hi <strong>${fullname}</strong> 👋<p style=font-size:15px;line-height:1.7;color:#cbd5f5>Please use the verification code below to securely confirm your email and continue shopping with us.<div style="text-align:center;margin:35px 0"><div style="display:inline-block;background:#020617;border:2px solid #22c55e;padding:18px 32px;border-radius:14px;font-size:36px;font-weight:700;letter-spacing:8px;color:#22c55e;box-shadow:0 0 20px rgba(34,197,94,.35)">${otp}</div></div><p style=font-size:14px;color:#e5e7eb>⏱ This OTP will expire in <strong>{{EXPIRY_TIME}} minutes</strong>.<p style=font-size:14px;color:#9ca3af;margin-top:10px>🔒 For your safety, never share this code with anyone.<div style="text-align:center;margin:35px 0"><a href={{ShopURL}} style="display:inline-block;background:#22c55e;color:#020617;padding:14px 34px;border-radius:999px;font-size:15px;font-weight:700;text-decoration:none">Continue Shopping →</a></div><p style=font-size:15px;margin-top:30px>Happy shopping 🛍️<br><strong>{{StoreName}} Team</strong><tr><td style="background:#020617;border-top:1px solid #1e293b;padding:20px;text-align:center;font-size:12px;color:#94a3b8">Need help? <a href=mailto:{{SupportEmail}} style=color:#22c55e;text-decoration:none>{{SupportEmail}}</a><br><br>© {{Year}} {{StoreName}}. All rights reserved.</table></table>`, 
  });
} catch (error) {
  if (error.responseCode === 534 || error.code === "EAUTH") {
    throw new Error("SMTP authentication was rejected. For Gmail, enable 2-Step Verification and use a newly generated 16-character App Password.");
  }
  throw error;
}

}
module.exports= sendEmail;