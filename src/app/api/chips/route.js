import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getAuthToken, checkIsAdmin, checkIsVerified } from '@/lib/auth';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const chipSchema = z.object({
  category: z.enum(["SPI", "EC"]).optional().default("SPI"),
  manufacturer: z.string().min(1, "Manufacturer is required").max(100),
  model: z.string().min(1, "Model is required").max(100),
  id: z.string().min(1, "Chip Hex ID is required").max(100), // maps to chip_id
  pageSize: z.number().int().positive("Page size must be a positive integer"),
  size: z.number().int().positive("Size must be a positive integer"),
  spiCommand: z.string().min(1, "SPI command is required").max(50),
  protocol: z.string().min(1, "Protocol is required").max(50),
  vcc: z.string().min(1, "VCC is required").max(20)
});

// In-memory cache for encrypted database payload (0ms response speed for desktop app)
let cachedEncryptedBuffer = null;
let lastCacheTime = 0;
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

export function invalidateChipCache() {
  cachedEncryptedBuffer = null;
  lastCacheTime = 0;
}

// Simple in-memory rate limiter (max 40 requests/min per IP)
const rateLimitMap = new Map();

function checkRateLimit(ip) {
  const now = Date.now();
  const windowMs = 60 * 1000;
  const maxReqs = 40;

  let record = rateLimitMap.get(ip);
  if (!record || now - record.startTime > windowMs) {
    record = { startTime: now, count: 1 };
    rateLimitMap.set(ip, record);
    return true;
  }

  record.count++;
  if (record.count > maxReqs) {
    return false;
  }
  return true;
}

// GET /api/chips - Return chips list for desktop app (encrypted full sync) or web (paginated JSON)
export async function GET(req) {
  try {
    const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || '127.0.0.1';
    if (!checkRateLimit(clientIp)) {
      return NextResponse.json(
        { error: "Too many requests. Please slow down." },
        { status: 429, headers: { 'Retry-After': '60' } }
      );
    }

    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search') || '';
    const includeUnapproved = searchParams.get('all') === 'true';
    const format = searchParams.get('format');
    const isEncryptedReq = format === 'enc' || format === 'encrypted' || req.headers.get('x-eeflasher-format') === 'encrypted';

    // Retrieve token if present to check uploader/admin visibility
    const token = await getAuthToken(req);
    const isAdmin = checkIsAdmin(token);

    // 1. DESKTOP APP FULL DATABASE SYNC (Requires Authorization Header)
    if (isEncryptedReq) {
      const secretKey = process.env.DATABASE_SECRET_KEY || "1fec0e752b9692981b0adf15537b22b6cc7a025038c08714ac4018a4a481b868";
      const requestKey = req.headers.get('x-eeflasher-key') || searchParams.get('key');

      // Security Guard: Prevent browser users from dumping full database via URL params
      if (requestKey !== secretKey) {
        return NextResponse.json(
          { error: "Access Denied: Full database export requires authorized desktop application headers." },
          { status: 403 }
        );
      }

      // Check fast in-memory cache (< 1ms response time)
      if (cachedEncryptedBuffer && (Date.now() - lastCacheTime < CACHE_TTL_MS)) {
        return new Response(cachedEncryptedBuffer, {
          status: 200,
          headers: {
            'Content-Type': 'application/octet-stream',
            'Content-Disposition': 'attachment; filename="Chipsliste.enc"',
            'Cache-Control': 'public, max-age=3600'
          }
        });
      }

      // Query full DB for desktop sync
      let fullQuery = `
        SELECT manufacturer, model, chip_id AS id, page_size AS "pageSize", 
               size, spi_command AS "spiCommand", protocol, vcc, approved
        FROM chips
        WHERE approved = true
        ORDER BY manufacturer ASC, model ASC
      `;
      const fullResult = await query(fullQuery);

      const spiChips = [];
      const ecChips = [];
      for (const chip of fullResult.rows) {
        const isEc = chip.protocol === 'SPI_EC' || chip.spiCommand === 'KB' || 
                     ['ENE', 'ITE', 'NUVOTON', 'SMSC', 'MICROCHIP_EC', 'MEC'].includes(chip.manufacturer?.toUpperCase());
        if (isEc) ecChips.push(chip);
        else spiChips.push(chip);
      }

      const syncPayload = {
        version: "2.2",
        total: fullResult.rowCount,
        Spi_Chips: spiChips,
        EC_Chips: ecChips,
        chips: fullResult.rows
      };

      const { encryptDatabase } = await import('@/lib/crypto');
      const encryptedBuffer = await encryptDatabase(JSON.stringify(syncPayload), secretKey);

      cachedEncryptedBuffer = encryptedBuffer;
      lastCacheTime = Date.now();

      return new Response(encryptedBuffer, {
        status: 200,
        headers: {
          'Content-Type': 'application/octet-stream',
          'Content-Disposition': 'attachment; filename="Chipsliste.enc"',
          'Cache-Control': 'public, max-age=3600'
        }
      });
    }

    // 2. WEB FRONTEND QUERY (Paginated: 10 per page, preventing mass database scraping)
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '10', 10)));
    const offset = (page - 1) * limit;

    let countQuery = "SELECT COUNT(*) FROM chips WHERE 1=1";
    let dataQuery = `
      SELECT manufacturer, model, chip_id AS id, page_size AS "pageSize", 
             size, spi_command AS "spiCommand", protocol, vcc, approved
      FROM chips
      WHERE 1=1
    `;
    const params = [];
    let paramCounter = 1;

    if (!isAdmin && !includeUnapproved) {
      countQuery += " AND approved = true";
      dataQuery += " AND approved = true";
    }

    if (search) {
      countQuery += ` AND (manufacturer ILIKE $${paramCounter} OR model ILIKE $${paramCounter} OR chip_id ILIKE $${paramCounter})`;
      dataQuery += ` AND (manufacturer ILIKE $${paramCounter} OR model ILIKE $${paramCounter} OR chip_id ILIKE $${paramCounter})`;
      params.push(`%${search}%`);
      paramCounter++;
    }

    const categoryParam = searchParams.get('category')?.toUpperCase();
    if (categoryParam === 'EC') {
      const ecFilter = " AND (protocol = 'SPI_EC' OR spi_command = 'KB' OR UPPER(manufacturer) IN ('ENE', 'ITE', 'NUVOTON', 'SMSC', 'MICROCHIP_EC', 'MEC'))";
      countQuery += ecFilter;
      dataQuery += ecFilter;
    } else if (categoryParam === 'SPI') {
      const spiFilter = " AND NOT (protocol = 'SPI_EC' OR spi_command = 'KB' OR UPPER(manufacturer) IN ('ENE', 'ITE', 'NUVOTON', 'SMSC', 'MICROCHIP_EC', 'MEC'))";
      countQuery += spiFilter;
      dataQuery += spiFilter;
    }

    const countResult = await query(countQuery, params);
    const totalItems = parseInt(countResult.rows[0].count, 10);
    const totalPages = Math.ceil(totalItems / limit) || 1;

    dataQuery += ` ORDER BY manufacturer ASC, model ASC LIMIT $${paramCounter} OFFSET $${paramCounter + 1}`;
    const dataParams = [...params, limit, offset];
    const dataResult = await query(dataQuery, dataParams);

    // Global counts query for filter button badges
    const globalCountsResult = await query(`
      SELECT 
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE NOT (protocol = 'SPI_EC' OR spi_command = 'KB' OR UPPER(manufacturer) IN ('ENE', 'ITE', 'NUVOTON', 'SMSC', 'MICROCHIP_EC', 'MEC'))) AS spi,
        COUNT(*) FILTER (WHERE (protocol = 'SPI_EC' OR spi_command = 'KB' OR UPPER(manufacturer) IN ('ENE', 'ITE', 'NUVOTON', 'SMSC', 'MICROCHIP_EC', 'MEC'))) AS ec
      FROM chips
      WHERE approved = true
    `);
    const counts = {
      total: parseInt(globalCountsResult.rows[0]?.total || 0, 10),
      spi: parseInt(globalCountsResult.rows[0]?.spi || 0, 10),
      ec: parseInt(globalCountsResult.rows[0]?.ec || 0, 10)
    };

    return NextResponse.json({
      version: "2.2",
      chips: dataResult.rows,
      counts: counts,
      pagination: {
        currentPage: page,
        totalPages: totalPages,
        totalItems: totalItems,
        limit: limit,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1
      }
    });
  } catch (err) {
    console.error("Error retrieving chips database:", err);
    return NextResponse.json({ error: "Failed to retrieve chips database." }, { status: 500 });
  }
}

// POST /api/chips - Submit a new chip
export async function POST(req) {
  const token = await getAuthToken(req);
  if (!token) {
    return NextResponse.json({ error: "Unauthorized. You must be logged in to add chips." }, { status: 401 });
  }

  // Get dynamic, real-time user status from DB
  const userResult = await query("SELECT verified, is_admin FROM users WHERE id = $1", [token.id]);
  if (userResult.rowCount === 0) {
    return NextResponse.json({ error: "Unauthorized. User account not found." }, { status: 401 });
  }
  const isVerified = checkIsVerified(userResult.rows[0]);
  const isUserAdmin = checkIsAdmin(userResult.rows[0]);

  // Check uploader verification if required
  const requireVerification = process.env.REQUIRE_UPLOADER_VERIFICATION === 'true';
  if (requireVerification && !isVerified) {
    return NextResponse.json({ error: "Access Denied. Your account must be verified before you can suggest chips." }, { status: 403 });
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
    const validation = chipSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues.map(e => e.message).join(", ") },
        { status: 400 }
      );
    }

    const {
      category = "SPI",
      manufacturer,
      model,
      id: chip_id,
      pageSize,
      size,
      spiCommand,
      protocol,
      vcc
    } = validation.data;

    let finalProtocol = protocol;
    let finalSpiCommand = spiCommand;

    if (category === "EC") {
      finalProtocol = "SPI_EC";
      if (!finalSpiCommand || finalSpiCommand === "SPI25") {
        finalSpiCommand = "KB";
      }
    }

    const normalized = `${manufacturer}_${model}`.toUpperCase().replace(/[^A-Z0-9]/g, '');

    // Check if duplicate model name already exists
    const duplicateCheck = await query(
      "SELECT id FROM chips WHERE normalized_model = $1 LIMIT 1",
      [normalized]
    );

    if (duplicateCheck.rowCount > 0) {
      return NextResponse.json({ error: "This chip model already exists in the database." }, { status: 400 });
    }

    // Auto-approve if uploaded by admin
    const approved = isUserAdmin;

    await query(
      `INSERT INTO chips (manufacturer, model, chip_id, page_size, size, spi_command, protocol, vcc, approved, normalized_model)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        manufacturer.trim(),
        model.trim(),
        chip_id.trim().toUpperCase(),
        pageSize,
        size,
        finalSpiCommand.trim(),
        finalProtocol.trim(),
        vcc.trim(),
        approved,
        normalized
      ]
    );

    invalidateChipCache();

    return NextResponse.json({
      message: approved ? "Chip added successfully!" : "Chip submitted successfully and is pending admin approval.",
      approved
    }, { status: 201 });
  } catch (err) {
    console.error("Error adding chip:", err);
    return NextResponse.json({ error: "Failed to add chip to database." }, { status: 500 });
  }
}

