import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getAuthToken, checkIsAdmin } from '@/lib/auth';
import { rateLimit, getClientIp } from '@/lib/rateLimit';

export const dynamic = 'force-dynamic';

async function verifyAdmin(req) {
  const token = await getAuthToken(req);
  if (!token) return false;

  const res = await query("SELECT plan FROM users WHERE id = $1", [token.id]);
  if (res.rowCount === 0) return false;
  return checkIsAdmin(res.rows[0]);
}

// GET /api/admin/chips - List all pending chips
export async function GET(req) {
  const ip = getClientIp(req);
  const limitRes = rateLimit(ip, 60, 60000);
  if (!limitRes.success) {
    return NextResponse.json(
      { error: "Too many requests. Please slow down." },
      { status: 429, headers: { 'Retry-After': '60' } }
    );
  }

  const isAdmin = await verifyAdmin(req);
  if (!isAdmin) {
    return NextResponse.json({ error: "Unauthorized. Admin privileges required." }, { status: 401 });
  }

  try {
    const result = await query(
      `SELECT id, manufacturer, model, chip_id AS "idHex", page_size AS "pageSize",
              size, spi_command AS "spiCommand", protocol, vcc, created_at
       FROM chips
       WHERE approved = false
       ORDER BY created_at DESC`
    );

    return NextResponse.json({ chips: result.rows });
  } catch (err) {
    console.error("Error fetching unapproved chips:", err);
    return NextResponse.json({ error: "Failed to fetch pending chips." }, { status: 500 });
  }
}

// POST /api/admin/chips - Perform approve or delete operations
export async function POST(req) {
  const ip = getClientIp(req);
  const limitRes = rateLimit(ip, 60, 60000);
  if (!limitRes.success) {
    return NextResponse.json(
      { error: "Too many requests. Please slow down." },
      { status: 429, headers: { 'Retry-After': '60' } }
    );
  }

  const isAdmin = await verifyAdmin(req);
  if (!isAdmin) {
    return NextResponse.json({ error: "Unauthorized. Admin privileges required." }, { status: 401 });
  }

  let body;
  try {
    body = await req.json();
  } catch (err) {
    return NextResponse.json(
      { error: "Invalid JSON payload." },
      { status: 400 }
    );
  }

  try {
    const { action, chipId } = body;

    if (!chipId) {
      return NextResponse.json({ error: "Missing chipId" }, { status: 400 });
    }

    if (action === 'approve') {
      await query("UPDATE chips SET approved = true WHERE id = $1", [chipId]);
      return NextResponse.json({ message: "Chip approved successfully." });
    }

    if (action === 'delete') {
      await query("DELETE FROM chips WHERE id = $1", [chipId]);
      return NextResponse.json({ message: "Chip rejected and deleted." });
    }

    return NextResponse.json({ error: "Invalid action." }, { status: 400 });
  } catch (err) {
    console.error("Error executing admin chip action:", err);
    return NextResponse.json({ error: "Failed to execute admin action." }, { status: 500 });
  }
}
