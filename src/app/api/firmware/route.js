import { NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { query } from '@/lib/db';
import { firmwareSchema } from '@/lib/validation';
import { rateLimit, getClientIp } from '@/lib/rateLimit';

export const dynamic = 'force-dynamic';

export async function GET(req) {
  // Rate Limiting for public read (100 requests per minute)
  const ip = getClientIp(req);
  const limitRes = rateLimit(ip, 100, 60000);
  if (!limitRes.success) {
    return NextResponse.json(
      { error: "Rate limit exceeded. Please try again later." },
      { status: 429 }
    );
  }

  const { searchParams } = new URL(req.url);
  const search = searchParams.get('search') || '';
  const deviceType = searchParams.get('device_type') || '';
  const page = parseInt(searchParams.get('page') || '1', 10);
  const limit = parseInt(searchParams.get('limit') || '10', 10);
  const offset = (page - 1) * limit;

  try {
    let queryText = `
      SELECT f.*, u.email as uploader_name
      FROM firmwares f
      LEFT JOIN users u ON f.uploaded_by = u.id
      WHERE 1=1
    `;
    const params = [];
    let paramCounter = 1;

    if (search) {
      queryText += ` AND (f.device_model ILIKE $${paramCounter} OR f.description ILIKE $${paramCounter} OR f.version ILIKE $${paramCounter})`;
      params.push(`%${search}%`);
      paramCounter++;
    }

    if (deviceType) {
      queryText += ` AND f.device_type = $${paramCounter}`;
      params.push(deviceType);
      paramCounter++;
    }

    // Count query for pagination totals
    const countQuery = `
      SELECT COUNT(*) as total
      FROM (${queryText}) as count_subquery
    `;
    const countResult = await query(countQuery, params);
    const totalItems = parseInt(countResult.rows[0].total, 10);
    const totalPages = Math.ceil(totalItems / limit);

    // Sorting & Pagination
    queryText += ` ORDER BY f.created_at DESC LIMIT $${paramCounter} OFFSET $${paramCounter + 1}`;
    params.push(limit, offset);

    const result = await query(queryText, params);

    return NextResponse.json({
      firmwares: result.rows,
      pagination: {
        totalItems,
        totalPages,
        currentPage: page,
        limit
      }
    });
  } catch (err) {
    console.error("Error retrieving firmwares:", err);
    return NextResponse.json(
      { error: "Failed to retrieve firmware list." },
      { status: 500 }
    );
  }
}

export async function POST(req) {
  // Authenticate user with NextAuth JWT
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token) {
    return NextResponse.json(
      { error: "Unauthorized. You must be logged in to upload firmware." },
      { status: 401 }
    );
  }

  // Get dynamic, real-time user status from DB
  const userResult = await query("SELECT verified FROM users WHERE id = $1", [token.id]);
  if (userResult.rowCount === 0) {
    return NextResponse.json(
      { error: "Unauthorized. User account not found." },
      { status: 401 }
    );
  }
  const isVerified = userResult.rows[0].verified;

  // Check uploader verification if required
  const requireVerification = process.env.REQUIRE_UPLOADER_VERIFICATION === 'true';
  if (requireVerification && !isVerified) {
    return NextResponse.json(
      { error: "Access Denied. Your uploader account must be verified by an administrator before you can upload files." },
      { status: 403 }
    );
  }

  // Rate Limiting
  const ip = getClientIp(req);
  const limitRes = rateLimit(ip, 30, 60000);
  if (!limitRes.success) {
    return NextResponse.json(
      { error: "Too many requests. Please wait a moment." },
      { status: 429 }
    );
  }

  try {
    const body = await req.json();

    // Validate schema
    const validation = firmwareSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues.map(e => e.message).join(", ") },
        { status: 400 }
      );
    }

    const {
      device_model,
      device_type,
      version,
      description,
      file_key,
      file_name,
      file_size,
      checksum,
      is_dump
    } = validation.data;

    // Save metadata in Postgres
    const result = await query(
      `INSERT INTO firmwares 
       (device_model, device_type, version, description, file_key, file_name, file_size, checksum, uploaded_by, is_dump) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [
        device_model,
        device_type,
        version,
        description || null,
        file_key,
        file_name,
        file_size,
        checksum,
        token.id,
        is_dump
      ]
    );

    return NextResponse.json(result.rows[0], { status: 201 });
  } catch (err) {
    console.error("Error creating firmware entry:", err);
    return NextResponse.json(
      { error: "Failed to save firmware metadata." },
      { status: 500 }
    );
  }
}
