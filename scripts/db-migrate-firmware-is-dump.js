const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

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
    console.error("DATABASE_URL is not defined.");
    process.exit(1);
  }

  console.log("Connecting to PostgreSQL to add 'is_dump' column...");
  const client = new Client({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log("Connected successfully. Modifying firmwares table...");

    await client.query(`
      ALTER TABLE firmwares ADD COLUMN IF NOT EXISTS is_dump BOOLEAN NOT NULL DEFAULT FALSE;
    `);
    console.log("✓ Added 'is_dump' column to firmwares table.");
    console.log("Database migration successfully completed!");
  } catch (err) {
    console.error("Migration failed:", err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
