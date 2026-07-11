import { NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req) {
  // Ensure the user is logged in
  const token = await getToken({
    req,
    secret: process.env.NEXTAUTH_SECRET,
    secureCookie: process.env.NODE_ENV === 'production',
  });
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const model = searchParams.get('model') || '';

  if (!model.trim()) {
    return NextResponse.json({ recommendedName: '', isApproved: false, exists: false });
  }

  try {
    const trimmedModel = model.trim();
    const normalized = trimmedModel.toUpperCase().replace(/[^A-Z0-9]/g, '');

    if (!normalized) {
      return NextResponse.json({ recommendedName: '', isApproved: false, exists: false });
    }

    // Check local DB for normalized matching model name
    const dbCheck = await query(
      "SELECT model_name, approved FROM device_models WHERE normalized_name = $1 LIMIT 1",
      [normalized]
    );

    if (dbCheck.rowCount > 0) {
      return NextResponse.json({
        recommendedName: dbCheck.rows[0].model_name,
        isApproved: dbCheck.rows[0].approved,
        exists: true,
        source: 'database'
      });
    }

    // Default to the user's original input as new model
    return NextResponse.json({
      recommendedName: trimmedModel,
      isApproved: false,
      exists: false,
      source: 'none'
    });
  } catch (err) {
    console.error("Error in check-model route:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

