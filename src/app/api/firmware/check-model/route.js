import { NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req) {
  // Ensure the user is logged in
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const model = searchParams.get('model') || '';

  if (!model.trim()) {
    return NextResponse.json({ recommendedName: '' });
  }

  try {
    const trimmedModel = model.trim();

    // 1. Check local DB (case-insensitive) to group under the exact same name
    const dbCheck = await query(
      "SELECT device_model FROM firmwares WHERE LOWER(device_model) = LOWER($1) LIMIT 1",
      [trimmedModel]
    );

    if (dbCheck.rowCount > 0) {
      return NextResponse.json({
        recommendedName: dbCheck.rows[0].device_model,
        source: 'database'
      });
    }

    // 2. Query DuckDuckGo Instant Answer API to search the internet
    try {
      const ddgRes = await fetch(
        `https://api.duckduckgo.com/?q=${encodeURIComponent(trimmedModel)}&format=json&t=eeflasher`,
        {
          headers: { 'User-Agent': 'EEFlasher-App/1.0' },
          next: { revalidate: 86400 } // Cache for 24 hours
        }
      );

      if (ddgRes.ok) {
        const data = await ddgRes.json();
        // If DDG returns a Heading that contains our search term (or vice versa), use that clean name
        if (data.Heading && data.Heading.toLowerCase().includes(trimmedModel.toLowerCase())) {
          return NextResponse.json({
            recommendedName: data.Heading,
            source: 'internet'
          });
        }
      }
    } catch (searchErr) {
      console.warn("Internet search lookup failed:", searchErr);
    }

    // Default to the user's original input
    return NextResponse.json({
      recommendedName: trimmedModel,
      source: 'none'
    });
  } catch (err) {
    console.error("Error in check-model route:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
