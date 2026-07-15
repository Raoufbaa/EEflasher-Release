import { NextResponse } from 'next/server';
import { s3Client } from '@/lib/b2';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { presignSchema } from '@/lib/validation';
import crypto from 'crypto';
import { rateLimit, getClientIp } from '@/lib/rateLimit';

export const dynamic = 'force-dynamic';

const DESKTOP_API_KEY = process.env.DESKTOP_API_KEY || "eeflasher_secret_desktop_key_2026";

export async function POST(req) {
  // Validate X-Desktop-API-Key
  const apiKey = req.headers.get('X-Desktop-API-Key');
  if (apiKey !== DESKTOP_API_KEY) {
    return NextResponse.json(
      { error: "Unauthorized. Invalid desktop API key." },
      { status: 401 }
    );
  }

  // Rate Limiting
  const ip = getClientIp(req);
  const limitRes = rateLimit(ip, 60, 60000); // 60 uploads per minute from desktop
  if (!limitRes.success) {
    return NextResponse.json(
      { error: "Too many upload requests. Please wait a moment." },
      { status: 429 }
    );
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
    const validation = presignSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues.map(e => e.message).join(", ") },
        { status: 400 }
      );
    }

    const { file_name, file_type } = validation.data;

    // Generate safe, unique S3 key
    const uniqueId = crypto.randomUUID();
    const cleanFileName = file_name.replace(/[^a-zA-Z0-9.-]/g, "_");
    const file_key = `firmwares/${uniqueId}-${cleanFileName}`;

    // Create PutObject command
    const command = new PutObjectCommand({
      Bucket: process.env.B2_BUCKET_NAME,
      Key: file_key,
      ContentType: file_type || 'application/octet-stream',
    });

    // Expiry: 15 minutes (900 seconds)
    const upload_url = await getSignedUrl(s3Client, command, { expiresIn: 900 });

    return NextResponse.json({
      upload_url,
      file_key
    });
  } catch (err) {
    console.error("Desktop presign URL generation failed:", err);
    return NextResponse.json(
      { error: "Failed to generate upload credentials." },
      { status: 500 }
    );
  }
}
