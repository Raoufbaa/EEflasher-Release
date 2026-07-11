import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { s3Client } from '@/lib/b2';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { rateLimit, getClientIp } from '@/lib/rateLimit';
import { getToken } from 'next-auth/jwt';

export async function GET(req, { params }) {
  // Await params for Next.js 15 compatibility
  const resolvedParams = await params;
  const { id } = resolvedParams;

  // Rate limiting for public downloads (60 downloads per minute per IP)
  const ip = getClientIp(req);
  const limitRes = rateLimit(ip, 60, 60000);
  if (!limitRes.success) {
    return NextResponse.json(
      { error: "Too many download requests. Please wait a moment." },
      { status: 429 }
    );
  }

  try {
    // 1. Fetch firmware record with approval status and uploader details
    const result = await query(
      `SELECT f.file_key, f.file_name, f.uploaded_by, m.approved
       FROM firmwares f
       JOIN device_models m ON f.model_id = m.id
       WHERE f.id = $1`,
      [id]
    );

    if (result.rowCount === 0) {
      return NextResponse.json(
        { error: "Firmware file not found." },
        { status: 404 }
      );
    }

    const { file_key, file_name, uploaded_by, approved } = result.rows[0];

    // If the device model is not approved yet, check permissions:
    // Only the uploader or an administrator can access/download it.
    if (!approved) {
      const token = await getToken({
        req,
        secret: process.env.NEXTAUTH_SECRET,
        secureCookie: process.env.NODE_ENV === 'production',
      });
      const isOwner = token && token.id === uploaded_by;
      const isAdmin = token && token.is_admin === true;

      if (!isOwner && !isAdmin) {
        return NextResponse.json(
          { error: "Forbidden. This firmware is associated with a model pending review. Only the owner of this file or an administrator can download it." },
          { status: 403 }
        );
      }
    }

    // 2. Increment download count in database
    await query(
      "UPDATE firmwares SET downloads_count = downloads_count + 1 WHERE id = $1",
      [id]
    );

    // 3. Generate B2 S3 pre-signed URL
    const command = new GetObjectCommand({
      Bucket: process.env.B2_BUCKET_NAME,
      Key: file_key,
      ResponseContentDisposition: `attachment; filename="${file_name.replace(/"/g, '\\"')}"`,
    });

    // Expiry: 5 minutes (300 seconds)
    const downloadUrl = await getSignedUrl(s3Client, command, { expiresIn: 300 });

    // 4. Redirect user to download location
    return NextResponse.redirect(downloadUrl, 307);
  } catch (err) {
    console.error("Failed to redirect to download:", err);
    return NextResponse.json(
      { error: "Internal server error." },
      { status: 500 }
    );
  }
}
