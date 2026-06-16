import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import bcrypt from 'bcryptjs';
import { registerSchema } from '@/lib/validation';
import { rateLimit, getClientIp } from '@/lib/rateLimit';

export async function POST(req) {
  // Apply rate limiting (5 attempts per minute)
  const ip = getClientIp(req);
  const limitRes = rateLimit(ip, 5, 60000);
  if (!limitRes.success) {
    return NextResponse.json(
      { error: "Too many registration attempts. Please try again in a minute." },
      { status: 429 }
    );
  }

  try {
    const body = await req.json();

    // Validate request schema
    const validation = registerSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues.map(e => e.message).join(", ") },
        { status: 400 }
      );
    }

    const { email, password } = validation.data;
    const lowerEmail = email.toLowerCase();

    // Check if user already exists
    const checkUser = await query("SELECT id FROM users WHERE LOWER(email) = $1", [lowerEmail]);
    if (checkUser.rowCount > 0) {
      return NextResponse.json(
        { error: "Email is already registered." },
        { status: 409 }
      );
    }

    // Hash the password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // Determine verification status based on ENV and whether this is the first user
    const requireVerification = process.env.REQUIRE_UPLOADER_VERIFICATION === 'true';
    const userCountRes = await query("SELECT COUNT(*) as count FROM users");
    const isFirstUser = parseInt(userCountRes.rows[0].count, 10) === 0;
    const verified = isFirstUser ? true : !requireVerification;
    const is_admin = isFirstUser ? true : false;

    // Save user to database
    await query(
      "INSERT INTO users (email, password_hash, verified, is_admin) VALUES ($1, $2, $3, $4)",
      [email, passwordHash, verified, is_admin]
    );

    return NextResponse.json(
      { message: "Registration successful. You can now log in." },
      { status: 201 }
    );
  } catch (err) {
    console.error("Error in registration API:", err);
    return NextResponse.json(
      { error: "Internal server error." },
      { status: 500 }
    );
  }
}
