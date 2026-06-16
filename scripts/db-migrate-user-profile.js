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

  console.log("Connecting to PostgreSQL for user profile columns migration...");
  const client = new Client({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log("Connected successfully. Starting migration...");

    // 1. Add name column to users table if not exists
    await client.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS name VARCHAR(255);
    `);
    console.log("✓ Added 'name' column to users.");

    // 2. Add profile_image column to users table if not exists
    await client.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_image VARCHAR(512);
    `);
    console.log("✓ Added 'profile_image' column to users.");

    console.log("Database user profile migration successfully completed!");
  } catch (err) {
    console.error("Migration failed:", err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
