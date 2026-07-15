const { Client } = require('pg');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// 1. Helper: Load environment variables from .env.local or .env
function loadEnv() {
  const envPaths = [
    path.join(__dirname, '../.env.local'),
    path.join(__dirname, '../.env'),
    path.join(__dirname, '.env.local'),
    path.join(__dirname, '.env')
  ];

  for (const envPath of envPaths) {
    if (fs.existsSync(envPath)) {
      // console.log(`[INFO] Loading env file from: ${envPath}`);
      const envContent = fs.readFileSync(envPath, 'utf8');
      const lines = envContent.split(/\r?\n/);
      for (const line of lines) {
        // Parse KEY=VALUE
        const match = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*["']?(.*?)["']?\s*$/);
        if (match) {
          const key = match[1];
          const val = match[2];
          if (!process.env[key]) {
            process.env[key] = val;
          }
        }
      }
      break;
    }
  }
}

loadEnv();

// Verify critical environment variables
const dbUrl = process.env.DATABASE_URL;
const b2KeyId = process.env.B2_KEY_ID;
const b2ApplicationKey = process.env.B2_APPLICATION_KEY;
const b2BucketName = process.env.B2_BUCKET_NAME;
const b2Endpoint = process.env.B2_ENDPOINT;

if (!dbUrl || !b2KeyId || !b2ApplicationKey || !b2BucketName || !b2Endpoint) {
  console.error("[ERROR] Missing required environment variables in your .env.local file.");
  console.error("Required variables: DATABASE_URL, B2_KEY_ID, B2_APPLICATION_KEY, B2_BUCKET_NAME, B2_ENDPOINT");
  process.exit(1);
}

// 2. Format / Validate Model Name matching Next.js backend logic
function formatModelName(name) {
  if (!name) return '';
  let formatted = name.toUpperCase().trim();
  // Insert hyphen between sequences of letters and digits (e.g. HG532 -> HG-532)
  formatted = formatted.replace(/([A-Z]+)(?=\d)/g, '$1-');
  return formatted;
}

const genericBlocklist = ['router', 'tv', 'box', 'receiver', 'bios', 'firmware', 'dump', 'device', 'printer', 'automotive', 'pc', 'ec'];
const brands = ['huawei', 'tplink', 'tp-link', 'dlink', 'd-link', 'asus', 'netgear', 'linksys', 'tenda', 'mercusys', 'totolink', 'xiaomi', 'zte', 'cisco', 'belkin', 'ubiquiti', 'mikrotik', 'samsung', 'lg', 'sony', 'panasonic'];

function isValidModelName(name) {
  if (!name) return false;
  const clean = name.toLowerCase().replace(/[^a-z0-9]/g, ' ').trim();
  
  if (!/\d/.test(clean)) {
    return false;
  }
  
  let remaining = clean;
  brands.forEach(brand => {
    const regex = new RegExp(`\\b${brand.replace('-', '')}\\b|\\b${brand}\\b`, 'gi');
    remaining = remaining.replace(regex, '');
  });
  genericBlocklist.forEach(word => {
    const regex = new RegExp(`\\b${word}\\b`, 'gi');
    remaining = remaining.replace(regex, '');
  });
  
  const finalCheck = remaining.replace(/\s+/g, '').trim();
  return finalCheck.length >= 2;
}

const ALLOWED_DEVICE_TYPES = ['Receiver', 'Router', 'TV', 'TV Box', 'Desktop BIOS', 'Laptop BIOS', 'EC Firmware', 'EEPROM Dump', 'Automotive', 'Printer', 'Other'];

// 3. Helper: Calculate SHA-256 checksum of a file
function calculateSha256(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);
    stream.on('data', data => hash.update(data));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', err => reject(err));
  });
}

// 4. Initialize B2 S3 Client
const getRegionFromEndpoint = (endpoint) => {
  if (!endpoint) return 'us-east-1';
  const match = endpoint.match(/s3\.([a-z0-9-]+)\.backblazeb2\.com/i);
  return match ? match[1] : 'us-east-1';
};

const s3Client = new S3Client({
  endpoint: b2Endpoint,
  region: getRegionFromEndpoint(b2Endpoint),
  credentials: {
    accessKeyId: b2KeyId,
    secretAccessKey: b2ApplicationKey,
  },
  forcePathStyle: true,
});

async function main() {
  const args = process.argv.slice(2);
  const targetDir = args[0];
  const uploaderEmail = args[1]; // Optional: Node scripts/bulk-import-firmware.js <dir> <email>

  if (!targetDir) {
    console.log("Usage: node scripts/bulk-import-firmware.js <directory-path> [uploader-email]");
    console.log("Example: node scripts/bulk-import-firmware.js C:/Uploads admin@eeflasher.com");
    process.exit(1);
  }

  const absoluteDir = path.resolve(targetDir);
  if (!fs.existsSync(absoluteDir) || !fs.statSync(absoluteDir).isDirectory()) {
    console.error(`[ERROR] Directory not found or is not a valid directory: ${absoluteDir}`);
    process.exit(1);
  }

  const manifestPath = path.join(absoluteDir, 'manifest.json');
  if (!fs.existsSync(manifestPath)) {
    console.error(`[ERROR] manifest.json not found in directory: ${absoluteDir}`);
    console.error("Please create a manifest.json file detailing the firmwares to import.");
    console.error("Format example:");
    console.error(JSON.stringify([
      {
        "file_path": "Latitude_3490.bin",
        "device_model": "Latitude 3490",
        "device_type": "Laptop BIOS",
        "version": "1.16.0",
        "description": "Dell Latitude 3490 clean bios region",
        "is_dump": false
      }
    ], null, 2));
    process.exit(1);
  }

  let manifest;
  try {
    const manifestContent = fs.readFileSync(manifestPath, 'utf8');
    manifest = JSON.parse(manifestContent);
  } catch (err) {
    console.error(`[ERROR] Failed to parse manifest.json: ${err.message}`);
    process.exit(1);
  }

  if (!Array.isArray(manifest) || manifest.length === 0) {
    console.error("[ERROR] manifest.json must be a non-empty array of firmware objects.");
    process.exit(1);
  }

  console.log(`[INFO] Found manifest with ${manifest.length} items to import.`);
  console.log(`[INFO] Connecting to PostgreSQL database...`);

  const dbClient = new Client({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await dbClient.connect();
    console.log(`[INFO] Connected to PostgreSQL.`);

    // 5. Determine uploader user ID
    let uploadedBy = null;
    if (uploaderEmail) {
      const userRes = await dbClient.query("SELECT id FROM users WHERE LOWER(email) = $1", [uploaderEmail.toLowerCase().trim()]);
      if (userRes.rowCount > 0) {
        uploadedBy = userRes.rows[0].id;
        console.log(`[INFO] Linking uploads to user ID: ${uploadedBy} (${uploaderEmail})`);
      } else {
        console.warn(`[WARN] Uploader email "${uploaderEmail}" not found in database. Defaulting to first admin user.`);
      }
    }

    if (!uploadedBy) {
      const adminRes = await dbClient.query("SELECT id, email FROM users WHERE is_admin = true LIMIT 1");
      if (adminRes.rowCount > 0) {
        uploadedBy = adminRes.rows[0].id;
        console.log(`[INFO] Linking uploads to default admin user ID: ${uploadedBy} (${adminRes.rows[0].email})`);
      } else {
        console.warn(`[WARN] No admin users found in database. uploads will have NULL uploaded_by.`);
      }
    }

    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < manifest.length; i++) {
      const item = manifest[i];
      const indexStr = `[${i + 1}/${manifest.length}]`;
      console.log(`\n----------------------------------------`);
      console.log(`${indexStr} Processing: ${item.file_path}`);

      // Validation
      if (!item.file_path || !item.device_model || !item.device_type || !item.version) {
        console.error(`  [ERROR] Missing required fields (file_path, device_model, device_type, version)`);
        failCount++;
        continue;
      }

      const filePath = path.join(absoluteDir, item.file_path);
      if (!fs.existsSync(filePath)) {
        console.error(`  [ERROR] File not found: ${filePath}`);
        failCount++;
        continue;
      }

      const rawModel = item.device_model;
      if (!isValidModelName(rawModel)) {
        console.error(`  [ERROR] Invalid model name "${rawModel}". Must contain a digit and be specific.`);
        failCount++;
        continue;
      }

      const formattedModel = formatModelName(rawModel);
      const normalizedModelName = formattedModel.replace(/[^A-Z0-9]/g, '');

      // Check device type
      if (!ALLOWED_DEVICE_TYPES.includes(item.device_type)) {
        console.warn(`  [WARN] Device type "${item.device_type}" is not in default list. Uploading as custom type.`);
      }

      try {
        const fileStats = fs.statSync(filePath);
        const fileSize = fileStats.size;

        console.log(`  Calculating SHA-256 checksum...`);
        const checksum = await calculateSha256(filePath);
        console.log(`  Checksum: ${checksum}`);

        // Upload to S3/B2
        const fileExtension = path.extname(item.file_path);
        const uniqueId = crypto.randomUUID();
        const cleanFileName = item.file_path.replace(/[^a-zA-Z0-9.-]/g, "_");
        const fileKey = `firmwares/${uniqueId}-${cleanFileName}`;

        console.log(`  Uploading to Backblaze B2 (Key: ${fileKey})...`);
        const fileBuffer = fs.readFileSync(filePath);
        const s3Command = new PutObjectCommand({
          Bucket: b2BucketName,
          Key: fileKey,
          ContentType: 'application/octet-stream',
          Body: fileBuffer
        });

        await s3Client.send(s3Command);
        console.log(`  ✓ Upload successful.`);

        // Insert/Get Model in DB
        console.log(`  Registering model and firmware metadata in DB...`);
        let modelId;
        const modelCheck = await dbClient.query(
          "SELECT id FROM device_models WHERE normalized_name = $1",
          [normalizedModelName]
        );

        if (modelCheck.rowCount > 0) {
          modelId = modelCheck.rows[0].id;
          console.log(`  Found existing model record (ID: ${modelId}).`);
        } else {
          const insertModel = await dbClient.query(
            `INSERT INTO device_models (device_type, model_name, normalized_name, approved) 
             VALUES ($1, $2, $3, $4) RETURNING id`,
            [item.device_type, formattedModel, normalizedModelName, true]
          );
          modelId = insertModel.rows[0].id;
          console.log(`  ✓ Created new model record (ID: ${modelId}).`);
        }

        // Insert Firmware
        await dbClient.query(
          `INSERT INTO firmwares 
           (device_model, device_type, version, description, file_key, file_name, file_size, checksum, uploaded_by, is_dump, model_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
          [
            formattedModel,
            item.device_type,
            item.version,
            item.description || '',
            fileKey,
            item.file_path,
            fileSize,
            checksum,
            uploadedBy,
            item.is_dump === true || item.is_dump === 'true',
            modelId
          ]
        );
        console.log(`  ✓ Firmware metadata registered successfully.`);
        successCount++;
      } catch (err) {
        console.error(`  [ERROR] Failed to process ${item.file_path}: ${err.message}`);
        failCount++;
      }
    }

    console.log(`\n========================================`);
    console.log(`[INFO] Import complete!`);
    console.log(`  - Successfully imported: ${successCount}`);
    console.log(`  - Failed imports: ${failCount}`);

  } catch (err) {
    console.error(`[ERROR] Database error: ${err.message}`);
  } finally {
    await dbClient.end();
    console.log(`[INFO] Database connection closed.`);
  }
}

main();
