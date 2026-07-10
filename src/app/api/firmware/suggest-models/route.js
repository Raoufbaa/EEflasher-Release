import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

function formatModelName(name) {
  if (!name) return '';
  let formatted = name.toUpperCase().trim();
  // Insert hyphen between sequences of letters and digits (e.g. HG532 -> HG-532)
  formatted = formatted.replace(/([A-Z]+)(?=\d)/g, '$1-');
  return formatted;
}

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const search = searchParams.get('search') || '';
  const deviceType = searchParams.get('device_type') || '';

  if (!search.trim()) {
    return NextResponse.json({ suggestions: [] });
  }

  try {
    const trimmed = search.trim();
    const suggestions = [];

    // Fetch matching APPROVED models from local PostgreSQL database
    let dbQuery = "SELECT DISTINCT model_name, device_type FROM device_models WHERE approved = true AND model_name ILIKE $1";
    const dbParams = [`%${trimmed}%`];

    if (deviceType) {
      dbQuery += " AND device_type = $2";
      dbParams.push(deviceType);
    }

    dbQuery += " ORDER BY model_name ASC LIMIT 6";
    const dbResult = await query(dbQuery, dbParams);

    dbResult.rows.forEach(row => {
      suggestions.push({
        name: formatModelName(row.model_name),
        source: 'database'
      });
    });

    return NextResponse.json({ suggestions });
  } catch (err) {
    console.error("Error fetching model suggestions:", err);
    return NextResponse.json({ error: "Failed to load suggestions" }, { status: 500 });
  }
}
