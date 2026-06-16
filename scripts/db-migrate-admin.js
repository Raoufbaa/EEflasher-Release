const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

// Read .env.local if DATABASE_URL is not set in environment
if (!process.env.DATABASE_URL) {
  const envPath = path.join(__dirname, '../.env.local');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    const lines = envContent.split(/\r?\n/);
    for (const line of lines) {
      const match = line.match(/^\s*DATABASE_URL\s*=\s*["']?(.*?)["']?\s*$/);
      if (match) {
        process.env.DATABASE_URL = match[1];
        break;
      }
    }
  }
}

async function main() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error("DATABASE_URL environment variable is not defined in environment or .env.local.");
    process.exit(1);
  }

  console.log("Connecting to PostgreSQL for admin column migration...");
  const client = new Client({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log("Connected successfully. Starting migration...");

    // 1. Add is_admin column to users table if not exists
    await client.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT FALSE;
    `);
    console.log("✓ Added 'is_admin' column to users.");

    // 2. Ensure existing users (which are our initial test users/admins) are marked as admins
    await client.query(`
      UPDATE users SET is_admin = TRUE WHERE is_admin IS NULL;
    `);
    // Also mark raoufbakhti32@gmail.com explicitly as admin if it exists
    await client.query(`
      UPDATE users SET is_admin = TRUE, verified = TRUE WHERE LOWER(email) = 'raoufbakhti32@gmail.com';
    `);
    console.log("✓ Updated admin status for existing accounts.");

    console.log("Database admin migration successfully completed!");
  } catch (err) {
    console.error("Migration failed:", err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
