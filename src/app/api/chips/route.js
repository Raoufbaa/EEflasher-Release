import { NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { query } from '@/lib/db';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const chipSchema = z.object({
  manufacturer: z.string().min(1, "Manufacturer is required").max(100),
  model: z.string().min(1, "Model is required").max(100),
  id: z.string().min(1, "Chip Hex ID is required").max(100), // maps to chip_id
  pageSize: z.number().int().positive("Page size must be a positive integer"),
  size: z.number().int().positive("Size must be a positive integer"),
  spiCommand: z.string().min(1, "SPI command is required").max(50),
  protocol: z.string().min(1, "Protocol is required").max(50),
  vcc: z.string().min(1, "VCC is required").max(20)
});

// GET /api/chips - Return chips list for desktop app and website
export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search') || '';
    const includeUnapproved = searchParams.get('all') === 'true';

    // Retrieve token if present to check uploader/admin visibility
    const token = await getToken({
      req,
      secret: process.env.NEXTAUTH_SECRET,
    });
    const isAdmin = token?.is_admin === true;

    let queryText = `
      SELECT manufacturer, model, chip_id AS id, page_size AS "pageSize", 
             size, spi_command AS "spiCommand", protocol, vcc, approved
      FROM chips
      WHERE 1=1
    `;
    const params = [];
    let paramCounter = 1;

    // Filter unapproved chips from public users unless user is admin
    if (!isAdmin && !includeUnapproved) {
      queryText += " AND approved = true";
    }

    if (search) {
      queryText += ` AND (manufacturer ILIKE $${paramCounter} OR model ILIKE $${paramCounter} OR chip_id ILIKE $${paramCounter})`;
      params.push(`%${search}%`);
      paramCounter++;
    }

    queryText += " ORDER BY manufacturer ASC, model ASC";
    const result = await query(queryText, params);

    return NextResponse.json({
      version: "2.2",
      total: result.rowCount,
      chips: result.rows
    });
  } catch (err) {
    console.error("Error retrieving chips database:", err);
    return NextResponse.json({ error: "Failed to retrieve chips database." }, { status: 500 });
  }
}

// POST /api/chips - Submit a new chip
export async function POST(req) {
  const token = await getToken({
    req,
    secret: process.env.NEXTAUTH_SECRET,
  });
  if (!token) {
    return NextResponse.json({ error: "Unauthorized. You must be logged in to add chips." }, { status: 401 });
  }

  // Get dynamic, real-time user status from DB
  const userResult = await query("SELECT verified, is_admin FROM users WHERE id = $1", [token.id]);
  if (userResult.rowCount === 0) {
    return NextResponse.json({ error: "Unauthorized. User account not found." }, { status: 401 });
  }
  const isVerified = userResult.rows[0].verified === 'true';
  const isUserAdmin = userResult.rows[0].is_admin;

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
      manufacturer,
      model,
      id: chip_id,
      pageSize,
      size,
      spiCommand,
      protocol,
      vcc
    } = validation.data;

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
    const approved = isUserAdmin === true;

    await query(
      `INSERT INTO chips (manufacturer, model, chip_id, page_size, size, spi_command, protocol, vcc, approved, normalized_model)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        manufacturer.trim(),
        model.trim(),
        chip_id.trim().toUpperCase(),
        pageSize,
        size,
        spiCommand.trim(),
        protocol.trim(),
        vcc.trim(),
        approved,
        normalized
      ]
    );

    return NextResponse.json({
      message: approved ? "Chip added successfully!" : "Chip submitted successfully and is pending admin approval.",
      approved
    }, { status: 201 });
  } catch (err) {
    console.error("Error adding chip:", err);
    return NextResponse.json({ error: "Failed to add chip to database." }, { status: 500 });
  }
}
