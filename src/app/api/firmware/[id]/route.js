import { NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { query } from '@/lib/db';
import { s3Client } from '@/lib/b2';
import { DeleteObjectCommand } from '@aws-sdk/client-s3';
import { rateLimit, getClientIp } from '@/lib/rateLimit';

export const dynamic = 'force-dynamic';

export async function DELETE(req, { params }) {
  // Authenticate user with NextAuth JWT
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token) {
    return NextResponse.json(
      { error: "Unauthorized. You must be logged in to delete firmware." },
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
  const dbUser = userResult.rows[0];
  const isVerified = dbUser.verified;
  const isAdmin = dbUser.is_admin;

  // Check uploader verification if required
  const requireVerification = process.env.REQUIRE_UPLOADER_VERIFICATION === 'true';
  if (requireVerification && !isVerified) {
    return NextResponse.json(
      { error: "Access Denied. Your uploader account must be verified by an administrator before you can delete files." },
      { status: 403 }
    );
  }

  // Rate Limiting
  const ip = getClientIp(req);
  const limitRes = rateLimit(ip, 30, 60000);
  if (!limitRes.success) {
    return NextResponse.json(
      { error: "Too many delete requests. Please wait a moment." },
      { status: 429 }
    );
  }

  // Await params for Next.js 15
  const resolvedParams = await params;
  const { id } = resolvedParams;

  try {
    // 1. Fetch file key and uploader ID from DB
    const result = await query("SELECT file_key, uploaded_by FROM firmwares WHERE id = $1", [id]);
    if (result.rowCount === 0) {
      return NextResponse.json(
        { error: "Firmware not found." },
        { status: 404 }
      );
    }

    const { file_key, uploaded_by } = result.rows[0];

    // Check delete permission: must be owner OR admin
    const isOwner = token.id === uploaded_by;

    if (!isOwner && !isAdmin) {
      return NextResponse.json(
        { error: "Forbidden. Only the owner of this file or an administrator can delete it." },
        { status: 403 }
      );
    }

    // 2. Delete file from Backblaze B2
    try {
      await s3Client.send(new DeleteObjectCommand({
        Bucket: process.env.B2_BUCKET_NAME,
        Key: file_key,
      }));
      console.log(`✓ Deleted file from B2: ${file_key}`);
    } catch (b2Err) {
      console.warn(`⚠️ Failed to delete ${file_key} from Backblaze B2 bucket: ${b2Err.message}. Proceeding to delete from database.`);
    }

    // 3. Delete record from PostgreSQL
    await query("DELETE FROM firmwares WHERE id = $1", [id]);
    console.log(`✓ Deleted firmware record from database: ${id}`);

    return NextResponse.json({ message: "Firmware deleted successfully." });
  } catch (err) {
    console.error("Error deleting firmware:", err);
    return NextResponse.json(
      { error: "Failed to delete firmware." },
      { status: 500 }
    );
  }
}
