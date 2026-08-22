import { NextResponse } from 'next/server';
import { getAuthToken, getUserPlan, checkIsAdmin } from '@/lib/auth';
import { query } from '@/lib/db';
import { encryptDatabase } from '@/lib/crypto';
import { rateLimit, getClientIp } from '@/lib/rateLimit';

export const dynamic = 'force-dynamic';

export async function POST(req) {
  // Apply rate limiting (15 attempts per minute)
  const ip = getClientIp(req);
  const limitRes = rateLimit(ip, 15, 60000);
  if (!limitRes.success) {
    return NextResponse.json(
      { error: "Too many requests. Please wait a minute." },
      { status: 429 }
    );
  }

  const token = await getAuthToken(req);
  if (!token || !token.id) {
    return NextResponse.json({ error: "Unauthorized. Please log in first." }, { status: 401 });
  }

  try {
    const userResult = await query(
      "SELECT id, email, name, profile_image, plan, plan_expires_at FROM users WHERE id = $1",
      [token.id]
    );

    if (userResult.rowCount === 0) {
      return NextResponse.json({ error: "User account not found." }, { status: 404 });
    }

    const user = userResult.rows[0];
    const activePlan = getUserPlan(user);

    const payload = {
      userId: user.id.toString(),
      email: user.email,
      name: user.name || user.email.split('@')[0],
      profileImage: user.profile_image || '/Assets/profile.jpg',
      plan: activePlan,
      planExpiresAt: user.plan_expires_at ? new Date(user.plan_expires_at).toISOString() : null,
      serverTimeUtc: new Date().toISOString(),
      issuedAtUtc: new Date().toISOString(),
      expiresAtUtc: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString() // 30-day desktop offline token
    };

    const secretKey = process.env.DATABASE_SECRET_KEY || "1fec0e752b9692981b0adf15537b22b6cc7a025038c08714ac4018a4a481b868";
    const encryptedBuffer = await encryptDatabase(JSON.stringify(payload), secretKey);
    const tokenBase64 = encryptedBuffer.toString('base64');

    return NextResponse.json({
      success: true,
      token: tokenBase64,
      user: {
        email: user.email,
        name: user.name,
        plan: activePlan,
        planExpiresAt: payload.planExpiresAt
      }
    });
  } catch (err) {
    console.error("Error generating desktop auth token:", err);
    return NextResponse.json({ error: "Failed to generate authorization token." }, { status: 500 });
  }
}
