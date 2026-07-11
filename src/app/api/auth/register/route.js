import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import bcrypt from 'bcryptjs';
import { registerSchema } from '@/lib/validation';
import { rateLimit, getClientIp } from '@/lib/rateLimit';
import { s3Client } from '@/lib/b2';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import crypto from 'crypto';

import { sendVerificationEmail } from '@/lib/email';

export async function POST(req) {
  // Apply rate limiting (5 attempts per minute)
  const ip = getClientIp(req);
  const limitRes = rateLimit(ip, 5, 60000);
  if (!limitRes.success) {
    return NextResponse.json(
      { error: "Too many registration attempts. Please try again in a minute." },
      { status: 429 }
    );
  }

  try {
    const formData = await req.formData();
    const email = formData.get('email');
    const password = formData.get('password');
    const name = formData.get('name');
    const imageFile = formData.get('profile_image'); // File object

    // Validate request schema
    const validation = registerSchema.safeParse({ email, password, name });
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues.map(e => e.message).join(", ") },
        { status: 400 }
      );
    }

    const { email: validatedEmail, password: validatedPassword, name: validatedName } = validation.data;
    const lowerEmail = validatedEmail.toLowerCase();

    // Check if user already exists
    const checkUser = await query("SELECT id FROM users WHERE LOWER(email) = $1", [lowerEmail]);
    if (checkUser.rowCount > 0) {
      return NextResponse.json(
        { error: "Email is already registered." },
        { status: 409 }
      );
    }

    // Process profile image upload to Backblaze B2
    let profileImageUrl = '/Assets/profile.jpg'; // default profile image

    if (imageFile && imageFile instanceof File && imageFile.size > 0) {
      const uniqueId = crypto.randomUUID();
      const cleanFileName = imageFile.name.replace(/[^a-zA-Z0-9.-]/g, "_");
      const fileKey = `profiles/${uniqueId}-${cleanFileName}`;

      const bytes = await imageFile.arrayBuffer();
      const buffer = Buffer.from(bytes);

      const uploadParams = {
        Bucket: process.env.B2_BUCKET_NAME,
        Key: fileKey,
        Body: buffer,
        ContentType: imageFile.type || 'image/jpeg',
      };

      await s3Client.send(new PutObjectCommand(uploadParams));

      // Build virtual hosted style B2 public URL
      const b2Endpoint = process.env.B2_ENDPOINT || '';
      const bucketName = process.env.B2_BUCKET_NAME || '';
      const cleanEndpoint = b2Endpoint.replace(/^https?:\/\//, '');
      profileImageUrl = `https://${bucketName}.${cleanEndpoint}/${fileKey}`;
    }

    // Hash the password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(validatedPassword, salt);

    // Determine verification status: first user is auto-verified admin, others are unverified
    const userCountRes = await query("SELECT COUNT(*) as count FROM users");
    const isFirstUser = parseInt(userCountRes.rows[0].count, 10) === 0;
    const is_admin = isFirstUser ? true : false;

    let verifiedVal = 'true';
    let otp = null;
 
    if (!isFirstUser) {
      // Generate a 6-digit OTP code
      otp = Math.floor(100000 + Math.random() * 900000).toString();
      // Hash the OTP (SHA-256)
      const otpHash = crypto.createHash('sha256').update(otp).digest('hex');
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes expiry
      // Store in verified column as 'otpHash|expiration'
      verifiedVal = `${otpHash}|${expiresAt.toISOString()}`;
    }
 
    // Save user with name and profile image to database
    await query(
      "INSERT INTO users (email, password_hash, verified, is_admin, name, profile_image) VALUES ($1, $2, $3, $4, $5, $6)",
      [email, passwordHash, verifiedVal, is_admin, validatedName, profileImageUrl]
    );
 
    if (!isFirstUser) {
      // Send verification email
      try {
        await sendVerificationEmail(lowerEmail, otp);
      } catch (emailError) {
        console.error("Failed to send verification OTP email during registration:", emailError);
        return NextResponse.json(
          { message: "Registration successful. However, we could not send the verification code. Please log in and request a new code." },
          { status: 201 }
        );
      }
 
      return NextResponse.json(
        { message: "Registration successful. Please check your email for your 6-digit verification code." },
        { status: 201 }
      );
    }
 
    return NextResponse.json(
      { message: "Registration successful. You can now log in." },
      { status: 201 }
    );
  } catch (err) {
    console.error("Error in registration API:", err);
    return NextResponse.json(
      { error: "Internal server error." },
      { status: 500 }
    );
  }
}
