import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { rateLimit, getClientIp } from '@/lib/rateLimit';
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
    const { token } = await req.json();

    if (!token || typeof token !== 'string') {
      return NextResponse.json(
        { error: "Verification token is required and must be a string." },
        { status: 400 }
      );
    }

    // Hash the incoming token (SHA-256) to look it up in the DB
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    // Query for the user record matching the token in verified column
    const userResult = await query(
      "SELECT id, verification_expires FROM users WHERE verified = $1",
      [tokenHash]
    );

    if (userResult.rowCount === 0) {
      return NextResponse.json(
        { error: "Invalid or expired verification link." },
        { status: 400 }
      );
    }

    const { id: user_id, verification_expires } = userResult.rows[0];

    // Check expiration
    if (verification_expires && new Date() > new Date(verification_expires)) {
      // Clear token since it is expired
      await query(
        "UPDATE users SET verified = 'false', verification_expires = NULL WHERE id = $1",
        [user_id]
      );
      return NextResponse.json(
        { error: "Verification link has expired. Please request a new link." },
        { status: 400 }
      );
    }

    // Update user verified status to 'true' and clear expiration
    await query(
      "UPDATE users SET verified = 'true', verification_expires = NULL WHERE id = $1",
      [user_id]
    );

    return NextResponse.json(
      { message: "Email verified successfully! You can now log in." },
      { status: 200 }
    );

  } catch (error) {
    console.error("Error in email verification API:", error);
    try {
      await query('ROLLBACK');
    } catch (e) {}
    
    return NextResponse.json(
      { error: "Internal server error." },
      { status: 500 }
    );
  }
}
