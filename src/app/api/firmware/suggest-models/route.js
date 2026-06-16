import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

function formatModelName(name) {
  if (!name) return '';
  let formatted = name.toUpperCase().trim();
  // Insert hyphen between sequences of letters and digits (e.g. HG532 -> HG-532)
  formatted = formatted.replace(/([A-Z]+)(?=\d)/g, '$1-');
  return formatted;
}

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const search = searchParams.get('search') || '';
  const deviceType = searchParams.get('device_type') || '';

  if (!search.trim()) {
    return NextResponse.json({ suggestions: [] });
  }

  try {
    const trimmed = search.trim();
    const suggestions = [];

    // 1. Fetch matching models from local PostgreSQL database
    let dbQuery = "SELECT DISTINCT device_model FROM firmwares WHERE device_model ILIKE $1";
    const dbParams = [`%${trimmed}%`];

    if (deviceType) {
      dbQuery += " AND device_type = $2";
      dbParams.push(deviceType);
    }

    dbQuery += " ORDER BY device_model ASC LIMIT 3";
    const dbResult = await query(dbQuery, dbParams);

    dbResult.rows.forEach(row => {
      suggestions.push({
        name: formatModelName(row.device_model),
        source: 'database'
      });
    });

    // 2. Fetch official topic/abstract from DuckDuckGo
    try {
      const ddgRes = await fetch(
        `https://api.duckduckgo.com/?q=${encodeURIComponent(trimmed)}&format=json&t=eeflasher`,
        {
          headers: { 'User-Agent': 'EEFlasher-App/1.0' },
          next: { revalidate: 3600 }
        }
      );

      if (ddgRes.ok) {
        const data = await ddgRes.json();
        if (data.Heading) {
          const formattedHeading = formatModelName(data.Heading);
          // Check if heading contains digits (valid model check)
          if (/\d/.test(formattedHeading) && !suggestions.some(s => s.name.toLowerCase() === formattedHeading.toLowerCase())) {
            suggestions.push({
              name: formattedHeading,
              source: 'internet'
            });
          }
        }
      }
    } catch (searchErr) {
      console.warn("Internet search lookup failed in suggestions:", searchErr);
    }

    // 3. Fetch from Google Autocomplete suggestions (contextualized by device type)
    try {
      const searchQueryWeb = deviceType ? `${trimmed} ${deviceType}` : trimmed;
      const googleRes = await fetch(
        `https://suggestqueries.google.com/complete/search?client=chrome&q=${encodeURIComponent(searchQueryWeb)}`,
        { next: { revalidate: 3600 } }
      );
      if (googleRes.ok) {
        const data = await googleRes.json();
        if (data && Array.isArray(data[1])) {
          const brands = ['huawei', 'tp-link', 'tplink', 'd-link', 'dlink', 'asus', 'netgear', 'linksys', 'tenda', 'mercusys', 'totolink', 'xiaomi', 'zte', 'cisco', 'belkin', 'ubiquiti', 'mikrotik'];
          const garbageWords = [
            'firmware', 'dump', 'bin', 'rom', 'flash', 'download', 'update', 'original', 'setup', 
            'configuration', 'config', 'default', 'password', 'admin', 'repeater', 'access point', 
            'openwrt', 'specs', 'datasheet', 'manual', 'marketplace', 'table', 'tool', 'wood', 'cnc', 
            'package', 'block', 'forum', 'how to', 'login', 'reset', 'with', 'for', 'the', 'what', 
            'is', 'how', 'to'
          ];

          data[1].forEach(suggestionText => {
            let clean = suggestionText.trim();
            
            // Check if suggestions contain generic garbage words - if so, discard immediately
            const hasGarbage = garbageWords.some(word => {
              const regex = new RegExp(`\\b${word}\\b`, 'i');
              return regex.test(clean);
            });
            if (hasGarbage) return;

            // Strip the category name (e.g. Router/Receiver) from the web suggestion
            if (deviceType) {
              const dtRegex = new RegExp(`\\b${deviceType}s?\\b`, 'gi');
              clean = clean.replace(dtRegex, '');
            }

            // Remove common search garbage words that are remaining
            garbageWords.forEach(word => {
              const regex = new RegExp(`\\b${word}\\b`, 'gi');
              clean = clean.replace(regex, '');
            });
            clean = clean.replace(/\s+/g, ' ').trim();

            if (!clean) return;

            // Enforce that a hardware model MUST contain at least one digit
            if (!/\d/.test(clean)) return;

            // Brand auto-capitalization & positioning
            let brandFound = '';
            brands.forEach(b => {
              if (clean.toLowerCase().includes(b)) {
                brandFound = b;
              }
            });

            if (brandFound) {
              const brandRegex = new RegExp(`\\b${brandFound}\\b`, 'gi');
              let withoutBrand = clean.replace(brandRegex, '').replace(/\s+/g, ' ').trim();
              const formattedBrand = brandFound === 'tplink' || brandFound === 'tp-link' ? 'TP-Link' 
                                   : brandFound === 'dlink' || brandFound === 'd-link' ? 'D-Link'
                                   : brandFound.charAt(0).toUpperCase() + brandFound.slice(1);
              clean = `${formattedBrand} ${formatModelName(withoutBrand)}`;
            } else {
              clean = formatModelName(clean);
            }

            clean = clean.trim();

            // Add suggestion if it contains the model (case-insensitive) and is unique
            if (
              clean && 
              clean.toLowerCase().replace(/[^a-z0-9]/g, '').includes(trimmed.toLowerCase().replace(/[^a-z0-9]/g, '')) &&
              !suggestions.some(s => s.name.toLowerCase() === clean.toLowerCase())
            ) {
              suggestions.push({
                name: clean,
                source: 'internet'
              });
            }
          });
        }
      }
    } catch (gErr) {
      console.warn("Google complete lookup failed in suggestions:", gErr);
    }

    // Return unique suggestions limited to 6 results
    return NextResponse.json({ suggestions: suggestions.slice(0, 6) });
  } catch (err) {
    console.error("Error fetching model suggestions:", err);
    return NextResponse.json({ error: "Failed to load suggestions" }, { status: 500 });
  }
}
