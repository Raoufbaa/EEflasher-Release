import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getUserPlan } from '@/lib/auth';
import { decryptDatabase, encryptDatabase } from '@/lib/crypto';
import { rateLimit, getClientIp } from '@/lib/rateLimit';

export const dynamic = 'force-dynamic';

export async function GET(req) {
  const ip = getClientIp(req);
  const limitRes = rateLimit(ip, 40, 60000);
  if (!limitRes.success) {
    return NextResponse.json(
      { error: "Too many requests. Please slow down." },
      { status: 429 }
    );
  }

  try {
    const authHeader = req.headers.get('authorization') || '';
    const tokenParam = new URL(req.url).searchParams.get('token');
    let rawToken = '';

    if (authHeader.startsWith('Bearer ')) {
      rawToken = authHeader.substring(7).trim();
    } else if (tokenParam) {
      rawToken = tokenParam.trim();
    }

    if (!rawToken) {
      return NextResponse.json({ error: "Missing authorization token." }, { status: 401 });
    }

    const secretKey = process.env.DATABASE_SECRET_KEY || "1fec0e752b9692981b0adf15537b22b6cc7a025038c08714ac4018a4a481b868";
    let tokenData;

    try {
      const encryptedBuffer = Buffer.from(rawToken, 'base64');
      const decryptedBuffer = await decryptDatabase(encryptedBuffer, secretKey);
      tokenData = JSON.parse(decryptedBuffer.toString('utf-8'));
    } catch {
      return NextResponse.json({ error: "Invalid or corrupted authorization token." }, { status: 401 });
    }

    if (!tokenData?.userId && !tokenData?.email) {
      return NextResponse.json({ error: "Invalid token claims." }, { status: 401 });
    }

    // Query database for latest real-time user status
    const userResult = await query(
      "SELECT id, email, name, profile_image, plan, plan_expires_at, verified FROM users WHERE id = $1 OR LOWER(email) = $2",
      [tokenData.userId || 0, (tokenData.email || '').toLowerCase()]
    );

    if (userResult.rowCount === 0) {
      return NextResponse.json({ error: "User account not found." }, { status: 404 });
    }

    const user = userResult.rows[0];
    const activePlan = getUserPlan(user);

    const freshPayload = {
      userId: user.id.toString(),
      email: user.email,
      name: user.name || user.email.split('@')[0],
      profileImage: user.profile_image || '/Assets/profile.jpg',
      plan: activePlan,
      planExpiresAt: user.plan_expires_at ? new Date(user.plan_expires_at).toISOString() : null,
      serverTimeUtc: new Date().toISOString(),
      issuedAtUtc: new Date().toISOString(),
      expiresAtUtc: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString()
    };

    const reEncryptedBuffer = await encryptDatabase(JSON.stringify(freshPayload), secretKey);

    return NextResponse.json({
      success: true,
      token: reEncryptedBuffer.toString('base64'),
      serverTimeUtc: freshPayload.serverTimeUtc,
      user: {
        userId: freshPayload.userId,
        email: freshPayload.email,
        name: freshPayload.name,
        profileImage: freshPayload.profileImage,
        plan: activePlan,
        planExpiresAt: freshPayload.planExpiresAt
      }
    });
  } catch (err) {
    console.error("Error in user status API:", err);
    return NextResponse.json({ error: "Failed to verify user status." }, { status: 500 });
  }
}
