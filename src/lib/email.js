import nodemailer from 'nodemailer';

// Create nodemailer transporter
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

const sendEmail = async (mailOptions) => {
  try {
    await transporter.sendMail(mailOptions);
    return true;
  } catch (error) {
    console.error("Error sending email via nodemailer:", error);
    throw error;
  }
};

/**
 * Sends a verification email to a newly registered user
 * @param {string} to Receiver's email
 * @param {string} verificationUrl The verification URL containing the token
 */
export const sendVerificationEmail = async (to, otp) => {
  const appName = process.env.NEXT_PUBLIC_APPNAME || 'EEFlasher';
  const mailOptions = {
    from: `"${appName}" <${process.env.EMAIL_USER}>`,
    to,
    subject: 'Your Verification Code - EEFlasher',
    html: `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Verify Your EEFlasher Account</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; background-color: #0b0e10; color: #dde3e8; line-height: 1.6;">
    <div style="background-color: #0b0e10; padding: 40px 10px; min-height: 100vh;">
        <div style="background-color: #111518; border: 1px solid #1e2428; border-radius: 8px; max-width: 500px; width: 95%; padding: 40px; margin: 0 auto; text-align: center; box-shadow: 0 8px 32px rgba(0,0,0,0.5);">
            <div style="margin-bottom: 25px;">
                <img src="https://i0b6tkdu1q.ufs.sh/f/XAiYDdRKAy97uNDG9cUFnyzR5Io9UVHOhGge8qYbPMs2irJA" alt="EEFlasher Logo" style="max-width: 64px; border-radius: 8px; box-shadow: 0 4px 15px rgba(0,0,0,0.15);">
            </div>

            <h1 style="color: #ffffff; font-size: 22px; font-weight: 700; margin-bottom: 16px; letter-spacing: -0.01em;">Confirm Your Email</h1>

            <p style="color: #dde3e8; margin-bottom: 28px; font-size: 14px; line-height: 1.6;">
                Here is your 6-digit verification code (OTP). Enter this code on the database page to activate your uploader privileges.
            </p>

            <!-- OTP Box -->
            <div style="display: inline-block; background-color: #161b1f; border: 1px solid #1e2428; color: #ffffff; padding: 14px 40px; border-radius: 8px; font-weight: 700; font-size: 28px; letter-spacing: 6px; box-shadow: 0 4px 12px rgba(0,0,0,0.3); margin: 10px 0; font-family: monospace;">
                ${otp}
            </div>

            <p style="margin-top: 28px; font-size: 12px; color: #5a6470;">
                This code will expire in 15 minutes. If you did not register for an account, please ignore this email.
            </p>

            <div style="margin-top: 28px; border-top: 1px solid #1e2428; padding-top: 20px; font-size: 11px; color: #5a6470;">
                © ${new Date().getFullYear()} EEFlasher. Secure Firmware Flashing Platform.
            </div>
        </div>
    </div>
</body>
</html>
    `,
  };

  try {
    await sendEmail(mailOptions);
  } catch (error) {
    throw new Error('Failed to send verification email.');
  }
};
