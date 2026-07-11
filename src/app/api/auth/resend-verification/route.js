import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { rateLimit, getClientIp } from '@/lib/rateLimit';
import { sendVerificationEmail } from '@/lib/email';
import crypto from 'crypto';

export async function POST(req) {
  const ip = getClientIp(req);

  try {
    const { email } = await req.json();

    if (!email || typeof email !== 'string') {
      return NextResponse.json(
        { error: "Email address is required." },
        { status: 400 }
      );
    }

    const lowerEmail = email.toLowerCase().trim();

    // Enforce rate limiting specifically for resending emails (max 3 resends per 5 minutes per email/IP)
    const rateLimitKey = `${ip}:${lowerEmail}`;
    const limitRes = rateLimit(rateLimitKey, 3, 300000); // 5 minutes window
    if (!limitRes.success) {
      return NextResponse.json(
        { error: "Too many requests. Please wait a few minutes before requesting another verification email." },
        { status: 429 }
      );
    }

    // Query database for user
    const userResult = await query(
      "SELECT id, verified FROM users WHERE LOWER(email) = $1",
      [lowerEmail]
    );

    if (userResult.rowCount === 0) {
      // Protect against email enumeration: return success even if email doesn't exist
      return NextResponse.json(
        { message: "If the account exists and is unverified, a verification link has been sent." },
        { status: 200 }
      );
    }

    const user = userResult.rows[0];

    if (user.verified === 'true') {
      return NextResponse.json(
        { error: "This email address is already verified. You can log in." },
        { status: 400 }
      );
    }

    // Generate a secure random token
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours expiry

    // Save token hash and expiration in the users table
    await query(
      "UPDATE users SET verified = $1, verification_expires = $2 WHERE id = $3",
      [tokenHash, expiresAt, user.id]
    );

    // Send verification email
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
    const verificationUrl = `${siteUrl}/verify-email?token=${rawToken}`;
    
    await sendVerificationEmail(lowerEmail, verificationUrl);

    return NextResponse.json(
      { message: "Verification link sent! Please check your email inbox and spam folder." },
      { status: 200 }
    );

  } catch (error) {
    console.error("Error in resend verification API:", error);
    try {
      await query('ROLLBACK');
    } catch (e) {}

    return NextResponse.json(
      { error: "Internal server error." },
      { status: 500 }
    );
  }
}
