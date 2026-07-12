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
  const email = process.argv[2];
  if (!email) {
    console.error("Usage: node scripts/make-admin.js <email>");
    process.exit(1);
  }

  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error("DATABASE_URL is not defined in environment or .env.local.");
    process.exit(1);
  }

  const targetEmail = email.trim().toLowerCase();
  console.log(`Connecting to PostgreSQL to promote user: ${targetEmail}`);

  const client = new Client({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    
    // Check if user exists
    const checkRes = await client.query("SELECT id, email, is_admin, verified FROM users WHERE LOWER(email) = $1", [targetEmail]);
    if (checkRes.rowCount === 0) {
      console.error(`Error: User with email "${email}" not found in database.`);
      process.exit(1);
    }

    const user = checkRes.rows[0];
    console.log(`Found User: ID=${user.id}, Current Admin=${user.is_admin}, Verified=${user.verified}`);

    // Update status
    await client.query(
      "UPDATE users SET is_admin = TRUE, verified = 'true' WHERE id = $1",
      [user.id]
    );

    console.log(`✓ Success! User "${user.email}" has been set as ADMIN and VERIFIED.`);
  } catch (err) {
    console.error("Failed to promote user to admin:", err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
