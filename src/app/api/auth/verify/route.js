import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { rateLimit, getClientIp } from '@/lib/rateLimit';
import { getToken } from 'next-auth/jwt';
import crypto from 'crypto';

export async function POST(req) {
  // Apply rate limiting (10 verification attempts per minute)
  const ip = getClientIp(req);
  const limitRes = rateLimit(ip, 10, 60000);
  if (!limitRes.success) {
    return NextResponse.json(
      { error: "Too many verification attempts. Please try again in a minute." },
      { status: 429 }
    );
  }

  try {
    // Get session token to identify the logged-in user
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
    if (!token) {
      return NextResponse.json(
        { error: "Unauthorized. You must be logged in to verify your account." },
        { status: 401 }
      );
    }

    const { otp } = await req.json();

    if (!otp || typeof otp !== 'string' || !/^\d{6}$/.test(otp)) {
      return NextResponse.json(
        { error: "Verification code must be a 6-digit number." },
        { status: 400 }
      );
    }

    // Hash the incoming OTP (SHA-256) to compare it with the DB value
    const otpHash = crypto.createHash('sha256').update(otp).digest('hex');

    // Query for the user record from the DB
    const userResult = await query(
      "SELECT verified FROM users WHERE id = $1",
      [token.id]
    );

    if (userResult.rowCount === 0) {
      return NextResponse.json(
        { error: "User account not found." },
        { status: 404 }
      );
    }

    const dbUser = userResult.rows[0];

    // Check if user is already verified
    if (dbUser.verified === 'true') {
      return NextResponse.json(
        { message: "Your email is already verified." },
        { status: 200 }
      );
    }

    // Check if verification string contains the hash and expiration date
    if (!dbUser.verified || !dbUser.verified.includes('|')) {
      return NextResponse.json(
        { error: "No active verification code found. Please request a new one." },
        { status: 400 }
      );
    }

    const [storedHash, expiresStr] = dbUser.verified.split('|');

    // Check if the OTP matches
    if (storedHash !== otpHash) {
      return NextResponse.json(
        { error: "Invalid verification code. Please check the code and try again." },
        { status: 400 }
      );
    }

    // Check expiration
    if (new Date() > new Date(expiresStr)) {
      // Clear expired OTP in the users table
      await query(
        "UPDATE users SET verified = 'false' WHERE id = $1",
        [token.id]
      );
      return NextResponse.json(
        { error: "Verification code has expired. Please request a new code." },
        { status: 400 }
      );
    }

    // Update user verified status to 'true'
    await query(
      "UPDATE users SET verified = 'true' WHERE id = $1",
      [token.id]
    );

    return NextResponse.json(
      { message: "Email verified successfully! Your uploader privileges are now active." },
      { status: 200 }
    );

  } catch (error) {
    console.error("Error in email verification API:", error);
    return NextResponse.json(
      { error: "Internal server error." },
      { status: 500 }
    );
  }
}
