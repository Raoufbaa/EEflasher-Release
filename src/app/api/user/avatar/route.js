import { NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { query } from '@/lib/db';
import { s3Client } from '@/lib/b2';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export const dynamic = 'force-dynamic';

export async function GET(req) {
  const token = await getToken({
    req,
    secret: process.env.NEXTAUTH_SECRET,
  });
  if (!token) {
    // Return default profile picture if not logged in
    return NextResponse.redirect(new URL('/Assets/profile.jpg', req.url));
  }

  try {
    // Query database for the user's profile image URL/key
    const result = await query("SELECT profile_image FROM users WHERE id = $1", [token.id]);
    if (result.rowCount === 0) {
      return NextResponse.redirect(new URL('/Assets/profile.jpg', req.url));
    }

    const profileImage = result.rows[0].profile_image;

    // If it is the default image or not on B2, redirect directly to it
    if (!profileImage || profileImage.startsWith('/')) {
      return NextResponse.redirect(new URL(profileImage || '/Assets/profile.jpg', req.url));
    }

    // Otherwise, it is stored in Backblaze B2. Extract the key.
    const b2Endpoint = process.env.B2_ENDPOINT || '';
    const bucketName = process.env.B2_BUCKET_NAME || '';
    const cleanEndpoint = b2Endpoint.replace(/^https?:\/\//, '');
    
    // Construct search prefix to extract key
    const prefix = `https://${bucketName}.${cleanEndpoint}/`;
    let fileKey = '';
    if (profileImage.startsWith(prefix)) {
      fileKey = profileImage.substring(prefix.length);
    } else {
      // Fallback parser if the URL style is different
      const urlParts = profileImage.split('.com/');
      if (urlParts.length > 1) {
        fileKey = urlParts[1];
      }
    }

    if (!fileKey) {
      return NextResponse.redirect(new URL('/Assets/profile.jpg', req.url));
    }

    // Generate a presigned B2 GET URL (valid for 5 minutes)
    const command = new GetObjectCommand({
      Bucket: process.env.B2_BUCKET_NAME,
      Key: fileKey,
    });

    const downloadUrl = await getSignedUrl(s3Client, command, { expiresIn: 300 });

    // Redirect the browser to load the image securely from Backblaze B2
    return NextResponse.redirect(downloadUrl, 307);
  } catch (err) {
    console.error("Error serving profile image redirect:", err);
    return NextResponse.redirect(new URL('/Assets/profile.jpg', req.url));
  }
}
