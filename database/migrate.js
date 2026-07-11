const fs = require('fs');
const path = require('path');

// Dynamically add node_modules paths to resolve 'pg'
const possibleNodeModules = [
  path.join(__dirname, '../node_modules'),
  path.join(__dirname, '../EEflasher-Release/node_modules'),
];

for (const dir of possibleNodeModules) {
  if (fs.existsSync(dir)) {
    module.paths.push(dir);
  }
}

let Client;
try {
  ({ Client } = require('pg'));
} catch (e) {
  console.error("Error: The 'pg' module could not be loaded. Please run this script in an environment where 'pg' is installed (e.g. inside the 'EEflasher-Release' directory or by running 'npm install pg').");
  process.exit(1);
}

// Function to find and parse .env.local or .env
function getDatabaseUrl() {
  const possiblePaths = [
    path.join(__dirname, '.env.local'),
    path.join(__dirname, '.env'),
    path.join(__dirname, '../.env.local'),
    path.join(__dirname, '../.env'),
    path.join(__dirname, '../EEflasher-Release/.env.local'),
    path.join(__dirname, '../EEflasher-Release/.env'),
  ];

  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      console.log(`Reading environment file from: ${p}`);
      const content = fs.readFileSync(p, 'utf8');
      const lines = content.split(/\r?\n/);
      for (const line of lines) {
        // Match DATABASE_URL with optional quotes
        const match = line.match(/^\s*DATABASE_URL\s*=\s*["']?(.*?)["']?\s*$/);
        if (match) {
          return match[1];
        }
      }
    }
  }
  return process.env.DATABASE_URL;
}

// Function to locate Chipsliste.json
function getChipslistePath() {
  const possiblePaths = [
    path.join(__dirname, 'Chipsliste.json'),
    path.join(__dirname, '../Chipsliste.json'),
    path.join(__dirname, '../src/lib/Chipsliste.json'),
    path.join(__dirname, '../EEflasher-Release/src/lib/Chipsliste.json'),
    path.join(__dirname, '../EEFlasher/Assets/ChipDatabase/Chipsliste.json'),
  ];

  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      return p;
    }
  }
  return null;
}

async function main() {
  const dbUrl = getDatabaseUrl();
  if (!dbUrl) {
    console.error("Error: DATABASE_URL not found in .env, .env.local, or environment variables.");
    process.exit(1);
  }

  // Hide password in logged output
  const maskedUrl = dbUrl.replace(/:([^:@]+)@/, ':******@');
  console.log(`Connecting to PostgreSQL database: ${maskedUrl}`);

  const client = new Client({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log("Connected successfully to PostgreSQL database.");

    // 1. Execute schema.sql to create tables/indexes
    const schemaPath = path.join(__dirname, 'schema.sql');
    if (!fs.existsSync(schemaPath)) {
      console.error(`Error: schema.sql not found at ${schemaPath}`);
      process.exit(1);
    }

    console.log("Executing schema.sql to initialize database tables...");
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');
    await client.query(schemaSql);
    console.log("✓ Database schema initialized successfully.");

    console.log("Applying email verification schema changes...");
    await client.query(`
      ALTER TABLE users ALTER COLUMN verified TYPE VARCHAR(255) USING (CASE WHEN verified::text = 'true' THEN 'true' ELSE 'false' END);
      ALTER TABLE users ALTER COLUMN verified SET DEFAULT 'false';
      ALTER TABLE users DROP COLUMN IF EXISTS verification_expires;
      DROP TABLE IF EXISTS verification_tokens;
    `);
    console.log("✓ Database migrations for email verification applied successfully.");

    // 1.5 Migrate legacy 'PC BIOS' categories to 'Desktop BIOS' in existing records
    console.log("Migrating existing 'PC BIOS' records to 'Desktop BIOS'...");
    await client.query("UPDATE device_models SET device_type = 'Desktop BIOS' WHERE device_type = 'PC BIOS'");
    await client.query("UPDATE firmwares SET device_type = 'Desktop BIOS' WHERE device_type = 'PC BIOS'");
    console.log("✓ Existing categories updated.");

    // 2. Migrate chiplist into chips table
    const chipslistePath = getChipslistePath();
    if (!chipslistePath) {
      console.error("Error: Chipsliste.json could not be located in any standard paths.");
      process.exit(1);
    }

    console.log(`Reading chip database list from: ${chipslistePath}`);
    const chipslisteContent = fs.readFileSync(chipslistePath, 'utf8');
    const chipData = JSON.parse(chipslisteContent);
    const chips = chipData.chips || [];

    if (chips.length === 0) {
      console.log("No chips found in JSON database list.");
      return;
    }

    console.log(`Found ${chips.length} chips to migrate. Starting migration...`);

    let insertedCount = 0;
    let skippedCount = 0;

    // Use transaction for seeding to ensure speed and consistency
    await client.query('BEGIN');

    for (const chip of chips) {
      // Replicate the normalisation logic of next.js backend to ensure index matches
      const manufacturer = (chip.manufacturer || '').trim();
      const model = (chip.model || '').trim();
      const chip_id = (chip.id || '').trim().toUpperCase();
      const pageSize = parseInt(chip.pageSize, 10);
      const size = parseInt(chip.size, 10);
      const spiCommand = (chip.spiCommand || '').trim();
      const protocol = (chip.protocol || '').trim();
      const vcc = (chip.vcc || '').trim();

      const normalizedModel = `${manufacturer}_${model}`.toUpperCase().replace(/[^A-Z0-9]/g, '');

      if (!manufacturer || !model || chip_id === undefined) {
        console.warn(`Skipping invalid chip entry: ${JSON.stringify(chip)}`);
        continue;
      }

      // We migrate chips as approved (approved = true)
      const res = await client.query(
        `INSERT INTO chips 
         (manufacturer, model, chip_id, page_size, size, spi_command, protocol, vcc, approved, normalized_model)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         ON CONFLICT (normalized_model) DO NOTHING`,
        [
          manufacturer,
          model,
          chip_id,
          pageSize,
          size,
          spiCommand,
          protocol,
          vcc,
          true, // approved
          normalizedModel
        ]
      );

      if (res.rowCount > 0) {
        insertedCount++;
      } else {
        skippedCount++;
      }
    }

    await client.query('COMMIT');

    console.log(`✓ Migration completed!`);
    console.log(`  - New chips inserted: ${insertedCount}`);
    console.log(`  - Duplicate chips skipped (already exist): ${skippedCount}`);

  } catch (err) {
    console.error("Migration failed:", err);
    try {
      await client.query('ROLLBACK');
    } catch (e) {}
    process.exit(1);
  } finally {
    await client.end();
    console.log("Database connection closed.");
  }
}

main();
