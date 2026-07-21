import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { deleteFileFromB2 } from '@/lib/b2';
import { getAuthToken, checkIsAdmin } from '@/lib/auth';

export const dynamic = 'force-dynamic';

function formatModelName(name) {
  if (!name) return '';
  let formatted = name.toUpperCase().trim();
  formatted = formatted.replace(/([A-Z]+)(?=\d)/g, '$1-');
  return formatted;
}

// Helper to check if current logged-in user is an admin
async function verifyAdmin(req) {
  const token = await getAuthToken(req);
  if (!token) return false;

  const res = await query("SELECT is_admin FROM users WHERE id = $1", [token.id]);
  if (res.rowCount === 0) return false;
  return checkIsAdmin(res.rows[0]);
}

// GET /api/admin/models - Get all unapproved models
export async function GET(req) {
  const isAdmin = await verifyAdmin(req);
  if (!isAdmin) {
    return NextResponse.json({ error: "Unauthorized. Admin privileges required." }, { status: 401 });
  }

  try {
    const result = await query(
      `SELECT id, model_name, device_type, normalized_name, created_at,
              (SELECT COUNT(*) FROM firmwares WHERE model_id = device_models.id) AS firmwares_count
       FROM device_models
       WHERE approved = false
       ORDER BY created_at DESC`
    );

    return NextResponse.json({ models: result.rows });
  } catch (err) {
    console.error("Error fetching unapproved models:", err);
    return NextResponse.json({ error: "Failed to fetch pending models." }, { status: 500 });
  }
}

// POST /api/admin/models - Perform approve, merge, or delete actions on models
export async function POST(req) {
  const isAdmin = await verifyAdmin(req);
  if (!isAdmin) {
    return NextResponse.json({ error: "Unauthorized. Admin privileges required." }, { status: 401 });
  }

  let body;
  try {
    body = await req.json();
  } catch (err) {
    return NextResponse.json(
      { error: "Invalid JSON payload." },
      { status: 400 }
    );
  }

  try {
    const { action, modelId, typoModelId, canonicalModelName, deviceType } = body;

    if (action === 'approve') {
      if (!modelId) {
        return NextResponse.json({ error: "Missing modelId" }, { status: 400 });
      }

      await query("UPDATE device_models SET approved = true WHERE id = $1", [modelId]);
      return NextResponse.json({ message: "Model approved successfully." });
    }

    if (action === 'merge') {
      if (!typoModelId || !canonicalModelName) {
        return NextResponse.json({ error: "Missing typoModelId or canonicalModelName" }, { status: 400 });
      }

      const rawCanonical = canonicalModelName.trim();
      const normalizedCanonical = rawCanonical.toUpperCase().replace(/[^A-Z0-9]/g, '');

      if (!normalizedCanonical) {
        return NextResponse.json({ error: "Invalid canonical model name" }, { status: 400 });
      }

      // Fetch typo model type if not provided
      let type = deviceType;
      if (!type) {
        const typeRes = await query("SELECT device_type FROM device_models WHERE id = $1", [typoModelId]);
        if (typeRes.rowCount > 0) {
          type = typeRes.rows[0].device_type;
        } else {
          type = 'Other';
        }
      }

      // Check if target canonical model already exists
      let targetId;
      const targetCheck = await query(
        "SELECT id FROM device_models WHERE normalized_name = $1 LIMIT 1",
        [normalizedCanonical]
      );

      if (targetCheck.rowCount > 0) {
        targetId = targetCheck.rows[0].id;
      } else {
        // Create canonical model automatically approved
        const formatted = formatModelName(rawCanonical);
        const newModel = await query(
          `INSERT INTO device_models (device_type, model_name, normalized_name, approved)
           VALUES ($1, $2, $3, true)
           RETURNING id`,
          [type, formatted, normalizedCanonical]
        );
        targetId = newModel.rows[0].id;
      }

      // Re-link all firmwares associated with the typo model to the canonical model
      await query("UPDATE firmwares SET model_id = $1 WHERE model_id = $2", [targetId, typoModelId]);

      // Delete the typo model from database
      await query("DELETE FROM device_models WHERE id = $1", [typoModelId]);

      return NextResponse.json({ message: "Models merged successfully." });
    }

    if (action === 'delete') {
      if (!modelId) {
        return NextResponse.json({ error: "Missing modelId" }, { status: 400 });
      }

      // Fetch all firmwares associated with this model to delete their files from Backblaze B2
      const firmwaresRes = await query("SELECT id, file_key FROM firmwares WHERE model_id = $1", [modelId]);

      for (const fw of firmwaresRes.rows) {
        try {
          await deleteFileFromB2(fw.file_key);
        } catch (b2Err) {
          if (b2Err.name === 'NoSuchKey' || b2Err.code === 'NoSuchKey' || b2Err.$metadata?.httpStatusCode === 404) {
            console.warn(`⚠️ File ${fw.file_key} already deleted from B2.`);
          } else {
            console.error(`Failed to delete ${fw.file_key} from B2:`, b2Err);
          }
        }
      }

      // Delete the model record (will cascade delete the associated firmwares in PostgreSQL)
      await query("DELETE FROM device_models WHERE id = $1", [modelId]);

      return NextResponse.json({ message: "Model and all associated uploads deleted successfully." });
    }

    return NextResponse.json({ error: "Invalid action." }, { status: 400 });
  } catch (err) {
    console.error("Error executing admin action:", err);
    return NextResponse.json({ error: "Failed to perform admin action." }, { status: 500 });
  }
}
