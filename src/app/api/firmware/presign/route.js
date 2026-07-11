import { NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { s3Client } from '@/lib/b2';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { presignSchema } from '@/lib/validation';
import crypto from 'crypto';
import { rateLimit, getClientIp } from '@/lib/rateLimit';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';


export async function POST(req) {
  // Check JWT authorization
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
  const userResult = await query("SELECT verified FROM users WHERE id = $1", [token.id]);
  if (userResult.rowCount === 0) {
    return NextResponse.json(
      { error: "Unauthorized. User account not found." },
      { status: 401 }
    );
  }
  const isVerified = userResult.rows[0].verified === 'true';

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
      { error: "Too many upload requests. Please wait a moment." },
      { status: 429 }
    );
  }

  try {
    const body = await req.json();

    // Validate request body
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
    console.error("Presign URL generation failed:", err);
    return NextResponse.json(
      { error: "Failed to generate upload credentials." },
      { status: 500 }
    );
  }
}
