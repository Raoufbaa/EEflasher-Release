const { Client } = require('pg');

async function main() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error("DATABASE_URL environment variable is not defined.");
    process.exit(1);
  }

  console.log("Connecting to PostgreSQL for schema migration (dropping username column)...");
  const client = new Client({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log("Connected successfully. Starting migration...");

    // 1. Drop the NOT NULL constraint on username, or just drop the column entirely
    // Since we now use email for uploader credentials, username is obsolete.
    await client.query(`
      ALTER TABLE users DROP COLUMN IF EXISTS username;
    `);
    console.log("✓ Obsolete 'username' column dropped from users table.");

    // 2. Ensure email and verified columns exist (in case migration is run from scratch)
    await client.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS email VARCHAR(255) UNIQUE;
    `);
    
    // Make sure email column is NOT NULL
    await client.query(`
      ALTER TABLE users ALTER COLUMN email SET NOT NULL;
    `);
    console.log("✓ Email column verified and set to NOT NULL.");

    await client.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS verified BOOLEAN DEFAULT TRUE;
    `);
    console.log("✓ Verified column verified.");

    console.log("Database schema migration successfully completed!");
  } catch (err) {
    console.error("Migration failed:", err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
