import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const headers = {
      'Accept': 'application/vnd.github.v3+json'
    };
    if (process.env.GITHUB_TOKEN) {
      headers['Authorization'] = `token ${process.env.GITHUB_TOKEN}`;
    }

    // 1. Fetch latest release info
    const latestRes = await fetch("https://api.github.com/repos/Raoufbaa/EEflasher-Release/releases/latest", {
      headers,
      next: { revalidate: 3600 } // Cache results for 1 hour to prevent hitting GitHub rate limits
    });

    if (!latestRes.ok) {
      throw new Error(`Latest release fetch failed: HTTP ${latestRes.status}`);
    }

    const latestData = await latestRes.json();
    const ver = (latestData.tag_name || latestData.name || "").replace(/^v/i, "");
    const pub = latestData.published_at
      ? new Date(latestData.published_at).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })
      : "Recently";

    // 2. Fetch all releases using pagination
    let allReleases = [];
    let page = 1;
    const perPage = 100;

    while (true) {
      const allRes = await fetch(`https://api.github.com/repos/Raoufbaa/EEflasher-Release/releases?per_page=${perPage}&page=${page}`, {
        headers,
        next: { revalidate: 3600 }
      });

      if (!allRes.ok) {
        throw new Error(`Releases page ${page} fetch failed: HTTP ${allRes.status}`);
      }

      const releasesPage = await allRes.json();
      if (!releasesPage || releasesPage.length === 0) {
        break;
      }
      allReleases = allReleases.concat(releasesPage);
      if (releasesPage.length < perPage) {
        break;
      }
      page++;
    }

    // 3. Load baseline offsets from environment variables (e.g., legacy/previous downloads)
    const baseTotal = parseInt(process.env.DOWNLOADS_BASELINE_TOTAL || '0', 10);
    const baseWinX64 = parseInt(process.env.DOWNLOADS_BASELINE_WIN_X64 || '0', 10);
    const baseWinX86 = parseInt(process.env.DOWNLOADS_BASELINE_WIN_X86 || '0', 10);
    const baseLinux = parseInt(process.env.DOWNLOADS_BASELINE_LINUX || '0', 10);

    let total = baseTotal;
    let winX64Count = baseWinX64;
    let winX86Count = baseWinX86;
    let linuxCount = baseLinux;

    allReleases.forEach(release => {
      if (release.assets && release.assets.length > 0) {
        release.assets.forEach(asset => {
          const count = asset.download_count || 0;
          total += count;

          if (asset.name.includes('Setup.exe') && !asset.name.includes('x86')) {
            winX64Count += count;
          } else if (asset.name.includes('Setup_x86.exe')) {
            winX86Count += count;
          } else if (asset.name.includes('win-x64.zip')) {
            winX64Count += count;
          } else if (asset.name.includes('win-x86.zip')) {
            winX86Count += count;
          } else if (asset.name.includes('linux-x64.tar.gz')) {
            linuxCount += count;
          }
        });
      }
    });

    const formatNumber = (num) => {
      if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
      if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
      return num.toString();
    };

    return NextResponse.json({
      version: ver ? `v${ver}` : "Latest version",
      name: latestData.name || `v${ver}` || "Latest",
      date: pub,
      totalDl: formatNumber(total),
      winX64: formatNumber(winX64Count),
      winX86: formatNumber(winX86Count),
      linuxX64: formatNumber(linuxCount)
    });
  } catch (err) {
    console.error('API releases error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
