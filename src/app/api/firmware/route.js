import { NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { query } from '@/lib/db';
import { firmwareSchema } from '@/lib/validation';
import { rateLimit, getClientIp } from '@/lib/rateLimit';

export const dynamic = 'force-dynamic';

function formatModelName(name) {
  if (!name) return '';
  let formatted = name.toUpperCase().trim();
  // Insert hyphen between sequences of letters and digits (e.g. HG532 -> HG-532)
  formatted = formatted.replace(/([A-Z]+)(?=\d)/g, '$1-');
  return formatted;
}

const genericBlocklist = ['router', 'tv', 'box', 'receiver', 'bios', 'firmware', 'dump', 'device', 'printer', 'automotive', 'pc', 'ec'];
const brands = ['huawei', 'tplink', 'tp-link', 'dlink', 'd-link', 'asus', 'netgear', 'linksys', 'tenda', 'mercusys', 'totolink', 'xiaomi', 'zte', 'cisco', 'belkin', 'ubiquiti', 'mikrotik', 'samsung', 'lg', 'sony', 'panasonic'];

function isValidModelName(name) {
  if (!name) return false;
  const clean = name.toLowerCase().replace(/[^a-z0-9]/g, ' ').trim();
  
  // 1. Must contain at least one digit
  if (!/\d/.test(clean)) {
    return false;
  }
  
  // 2. Remove all brand names and generic words
  let remaining = clean;
  brands.forEach(brand => {
    const regex = new RegExp(`\\b${brand.replace('-', '')}\\b|\\b${brand}\\b`, 'gi');
    remaining = remaining.replace(regex, '');
  });
  genericBlocklist.forEach(word => {
    const regex = new RegExp(`\\b${word}\\b`, 'gi');
    remaining = remaining.replace(regex, '');
  });
  
  const finalCheck = remaining.replace(/\s+/g, '').trim();
  if (finalCheck.length < 2) {
    return false;
  }
  
  return true;
}

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

  // Retrieve token if present to check uploader/admin visibility
  const token = await getToken({
    req,
    secret: process.env.NEXTAUTH_SECRET,
    secureCookie: process.env.NODE_ENV === 'production',
  });
  const userId = token?.id || null;
  const isAdmin = token?.is_admin === true;

  try {
    let queryText = `
      SELECT f.id, f.version, f.description, f.file_key, f.file_name, f.file_size, f.checksum, f.downloads_count, f.uploaded_by, f.created_at, f.is_dump,
             m.model_name AS device_model, m.device_type AS device_type, m.approved AS is_approved,
             u.email as uploader_name
      FROM firmwares f
      JOIN device_models m ON f.model_id = m.id
      LEFT JOIN users u ON f.uploaded_by = u.id
      WHERE 1=1
    `;
    const params = [];
    let paramCounter = 1;

    // Filter unapproved model firmwares from public users
    if (!isAdmin) {
      if (userId) {
        queryText += ` AND (m.approved = TRUE OR f.uploaded_by = $${paramCounter})`;
        params.push(userId);
        paramCounter++;
      } else {
        queryText += ` AND m.approved = TRUE`;
      }
    }

    if (search) {
      queryText += ` AND (m.model_name ILIKE $${paramCounter} OR f.description ILIKE $${paramCounter} OR f.version ILIKE $${paramCounter})`;
      params.push(`%${search}%`);
      paramCounter++;
    }

    if (deviceType) {
      queryText += ` AND m.device_type = $${paramCounter}`;
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
  const token = await getToken({
    req,
    secret: process.env.NEXTAUTH_SECRET,
    secureCookie: process.env.NODE_ENV === 'production',
  });
  if (!token) {
    return NextResponse.json(
      { error: "Unauthorized. You must be logged in to upload firmware." },
      { status: 401 }
    );
  }

  // Get dynamic, real-time user status from DB
  const userResult = await query("SELECT verified, is_admin FROM users WHERE id = $1", [token.id]);
  if (userResult.rowCount === 0) {
    return NextResponse.json(
      { error: "Unauthorized. User account not found." },
      { status: 401 }
    );
  }
  const isVerified = userResult.rows[0].verified;
  const isUserAdmin = userResult.rows[0].is_admin;

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

    // Validate device model name logic (non-generic blocklist)
    if (!isValidModelName(device_model)) {
      return NextResponse.json(
        { error: "Invalid device model name. Please provide a specific model number containing alphanumeric characters (e.g. TL-WR841N) rather than a generic device type name." },
        { status: 400 }
      );
    }

    // Unify normalized name
    const rawModel = device_model.trim();
    const normalized = rawModel.toUpperCase().replace(/[^A-Z0-9]/g, '');

    // Look up model in database
    let modelId;
    let isApproved = false;

    const existingModel = await query(
      "SELECT id, approved, model_name FROM device_models WHERE normalized_name = $1 LIMIT 1",
      [normalized]
    );

    if (existingModel.rowCount > 0) {
      modelId = existingModel.rows[0].id;
      isApproved = existingModel.rows[0].approved;
    } else {
      // Create new model dynamically
      // If the uploader is an admin, the model is auto-approved instantly
      isApproved = isUserAdmin === true;
      const formattedModel = formatModelName(rawModel);

      const newModel = await query(
        `INSERT INTO device_models (device_type, model_name, normalized_name, approved)
         VALUES ($1, $2, $3, $4)
         RETURNING id`,
        [device_type, formattedModel, normalized, isApproved]
      );
      modelId = newModel.rows[0].id;
    }

    // Save metadata in Postgres
    const result = await query(
      `INSERT INTO firmwares 
       (device_model, device_type, version, description, file_key, file_name, file_size, checksum, uploaded_by, is_dump, model_id) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
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
        is_dump,
        modelId
      ]
    );

    return NextResponse.json({ ...result.rows[0], is_approved: isApproved }, { status: 201 });
  } catch (err) {
    console.error("Error creating firmware entry:", err);
    return NextResponse.json(
      { error: "Failed to save firmware metadata." },
      { status: 500 }
    );
  }
}
