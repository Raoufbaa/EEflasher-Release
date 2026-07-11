import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { rateLimit, getClientIp } from '@/lib/rateLimit';
import { sendVerificationEmail } from '@/lib/email';
import { getToken } from 'next-auth/jwt';
import crypto from 'crypto';

export async function POST(req) {
  const ip = getClientIp(req);

  try {
    // Get session token to identify the logged-in user
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
    if (!token || !token.email) {
      return NextResponse.json(
        { error: "Unauthorized. You must be logged in to request a verification code." },
        { status: 401 }
      );
    }

    const email = token.email;
    const lowerEmail = email.toLowerCase().trim();

    // Enforce rate limiting specifically for resending emails (max 3 resends per 5 minutes per email/IP)
    const rateLimitKey = `${ip}:${lowerEmail}`;
    const limitRes = rateLimit(rateLimitKey, 3, 300000); // 5 minutes window
    if (!limitRes.success) {
      return NextResponse.json(
        { error: "Too many requests. Please wait a few minutes before requesting another verification code." },
        { status: 429 }
      );
    }

    // Query database for user
    const userResult = await query(
      "SELECT id, verified FROM users WHERE LOWER(email) = $1",
      [lowerEmail]
    );

    if (userResult.rowCount === 0) {
      return NextResponse.json(
        { error: "User account not found." },
        { status: 404 }
      );
    }

    const user = userResult.rows[0];

    if (user.verified === 'true') {
      return NextResponse.json(
        { error: "This email address is already verified." },
        { status: 400 }
      );
    }

    // Generate a 6-digit OTP code
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpHash = crypto.createHash('sha256').update(otp).digest('hex');
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes expiry

    // Concatenate OTP hash and expiration time ISO string
    const verifiedVal = `${otpHash}|${expiresAt.toISOString()}`;

    // Save merged OTP token in the users table
    await query(
      "UPDATE users SET verified = $1 WHERE id = $2",
      [verifiedVal, user.id]
    );

    // Send verification email
    await sendVerificationEmail(lowerEmail, otp);

    return NextResponse.json(
      { message: "Verification code sent! Please check your email inbox." },
      { status: 200 }
    );

  } catch (error) {
    console.error("Error in resend verification API:", error);
    return NextResponse.json(
      { error: "Internal server error." },
      { status: 500 }
    );
  }
}
