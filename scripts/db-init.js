const { Client } = require('pg');
const { S3Client, PutBucketCorsCommand } = require('@aws-sdk/client-s3');

const getRegionFromEndpoint = (endpoint) => {
  if (!endpoint) return 'us-east-1';
  const match = endpoint.match(/s3\.([a-z0-9-]+)\.backblazeb2\.com/i);
  return match ? match[1] : 'us-east-1';
};

async function main() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error("DATABASE_URL environment variable is not defined.");
    process.exit(1);
  }

  // 1. Initialize PostgreSQL database tables
  console.log("Initializing connection to PostgreSQL...");
  const client = new Client({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log("Connected successfully to database. Creating tables...");

    // Create users table (using email instead of username)
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        verified BOOLEAN DEFAULT TRUE,
        is_admin BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log("✓ 'users' table initialized.");

    // Create firmwares table
    await client.query(`
      CREATE TABLE IF NOT EXISTS firmwares (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        device_model VARCHAR(255) NOT NULL,
        device_type VARCHAR(255) NOT NULL,
        version VARCHAR(100) NOT NULL,
        description TEXT,
        file_key VARCHAR(512) NOT NULL,
        file_name VARCHAR(255) NOT NULL,
        file_size BIGINT NOT NULL,
        checksum VARCHAR(64) NOT NULL,
        downloads_count INT DEFAULT 0,
        uploaded_by UUID REFERENCES users(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log("✓ 'firmwares' table initialized.");

    // Add search indexes
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_firmwares_device_type ON firmwares(device_type);
      CREATE INDEX IF NOT EXISTS idx_firmwares_device_model ON firmwares(device_model);
      CREATE INDEX IF NOT EXISTS idx_firmwares_created_at ON firmwares(created_at DESC);
    `);
    console.log("✓ Search indexes created.");
    console.log("Database schema successfully initialized!");

  } catch (err) {
    console.error("DB Initialization failed:", err);
    process.exit(1);
  } finally {
    await client.end();
  }

  // 2. Configure Backblaze B2 Bucket CORS rules
  const b2KeyId = process.env.B2_KEY_ID;
  const b2AppKey = process.env.B2_APPLICATION_KEY;
  const b2Bucket = process.env.B2_BUCKET_NAME;
  const b2Endpoint = process.env.B2_ENDPOINT;

  if (b2KeyId && b2AppKey && b2Bucket && b2Endpoint) {
    console.log("Initializing Backblaze B2 CORS configuration...");
    const s3Client = new S3Client({
      endpoint: b2Endpoint,
      region: getRegionFromEndpoint(b2Endpoint),
      credentials: {
        accessKeyId: b2KeyId,
        secretAccessKey: b2AppKey,
      },
      forcePathStyle: true,
    });

    try {
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
      await s3Client.send(new PutBucketCorsCommand({
        Bucket: b2Bucket,
        CORSConfiguration: {
          CORSRules: [
            {
              AllowedHeaders: ["*"],
              AllowedMethods: ["GET", "PUT", "POST", "HEAD"],
              AllowedOrigins: [siteUrl, "http://localhost:3000"],
              ExposeHeaders: ["ETag"],
              MaxAgeSeconds: 3600,
            }
          ]
        }
      }));
      console.log("✓ Backblaze B2 CORS rules configured successfully for:", siteUrl);
    } catch (b2Err) {
      console.warn("⚠️ Warning: Failed to set B2 CORS configuration automatically. Make sure B2 credentials can modify bucket permissions. Error:", b2Err.message);
    }
  } else {
    console.log("Skipping B2 CORS setup as some B2 environment variables are missing.");
  }
}

main();
