'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowDown, Info, Cpu, Check, Activity, ShieldAlert, Monitor, Terminal, Database as DbIcon } from 'lucide-react';
import styles from '@/styles/Home.module.css';

export default function Home() {
  const [releaseInfo, setReleaseInfo] = useState({
    version: 'Latest version',
    name: 'Latest stable',
    date: 'Checking...',
    totalDl: '—',
    winX64: '—',
    winX86: '—',
    linuxX64: '—'
  });

  const formatNumber = (num) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
  };

  useEffect(() => {
    async function loadRelease() {
      try {
        const latestRes = await fetch("https://api.github.com/repos/Raoufbaa/EEflasher-Release/releases/latest", {
          headers: {
            'Accept': 'application/vnd.github.v3+json'
          }
        });
        
        if (!latestRes.ok) {
          throw new Error(`HTTP ${latestRes.status}`);
        }
        
        const latestData = await latestRes.json();
        const ver = (latestData.tag_name || latestData.name || "").replace(/^v/i, "");
        const pub = latestData.published_at
          ? new Date(latestData.published_at).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })
          : "Recently";
        
        // Fetch ALL releases to get total download counts
        const allRes = await fetch("https://api.github.com/repos/Raoufbaa/EEflasher-Release/releases", {
          headers: {
            'Accept': 'application/vnd.github.v3+json'
          }
        });
        
        if (!allRes.ok) {
          throw new Error(`HTTP ${allRes.status}`);
        }
        
        const allReleases = await allRes.json();
        
        let total = 0;
        let winX64Count = 0;
        let winX86Count = 0;
        let linuxCount = 0;
        
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

        setReleaseInfo({
          version: ver ? `v${ver}` : "Latest version",
          name: latestData.name || `v${ver}` || "Latest",
          date: pub,
          totalDl: formatNumber(total),
          winX64: formatNumber(winX64Count),
          winX86: formatNumber(winX86Count),
          linuxX64: formatNumber(linuxCount)
        });
        
      } catch (err) {
        console.error('Failed to fetch release data from GitHub:', err);
        
        // Fallback to local version.json
        try {
          const fb = await fetch("/version.json");
          const data = await fb.json();
          setReleaseInfo({
            version: `v${data.SupportedVersions[0]}`,
            name: `EEFlasher ${data.SupportedVersions[0]}`,
            date: "Latest",
            totalDl: "N/A",
            winX64: "N/A",
            winX86: "N/A",
            linuxX64: "N/A"
          });
        } catch (fbErr) {
          console.error('Fallback also failed:', fbErr);
          setReleaseInfo(prev => ({
            ...prev,
            date: "See GitHub",
            totalDl: "N/A"
          }));
        }
      }
    }

    loadRelease();
  }, []);

  return (
    <main className={styles.page}>
      
      {/* Hero Section */}
      <section className={styles.hero}>
        <div className={styles.badge}>
          <span className={styles.badgeDot}></span>
          <span>{releaseInfo.version}</span>
        </div>
        <h2>Modern EEPROM &amp; Flash Programmer</h2>
        <p>A cross-platform replacement for AsProgrammer — built on .NET 10 and Avalonia with a clean dark UI, faster write speeds, and full cancellation support.</p>

        <div className={styles.heroActions}>
          <a className={`${styles.btn} ${styles.btnAccent}`} style={{ width: 'auto' }} href="https://github.com/Raoufbaa/EEflasher-Release/releases/latest/download/EEFlasher_Setup.exe">
            <ArrowDown size={16} />
            Download for Windows x64
          </a>
          <Link href="/database" className={`${styles.btn} ${styles.btnGhost}`} style={{ width: 'auto', border: '1px solid var(--accent)', color: '#8487d4' }}>
            <Cpu size={16} />
            Firmware Database
          </Link>
        </div>

        <div className={styles.heroMeta}>
          <span>
            <Check size={12} className={styles.check} /> Self-contained
          </span>
          <span>
            <Check size={12} className={styles.check} /> Windows 10/11
          </span>
          <span>
            <Check size={12} className={styles.check} /> Linux x64
          </span>
          <span>
            <Check size={12} className={styles.check} /> MIT License
          </span>
        </div>
      </section>

      {/* Downloads Grid */}
      <div className={styles.divider} id="downloads">Platform packages</div>
      
      <div className={styles.downloads}>
        {/* Windows x64 Card */}
        <div className={`${styles.dlCard} ${styles.dlCardFeatured}`}>
          <div className={styles.dlTop}>
            <h3>Windows x64</h3>
            <span className={`${styles.tag} ${styles.tagGreen}`}>Recommended</span>
          </div>
          <p className={styles.dlSub}>Installer for 64-bit Windows 10 and 11, bundled with all required DLLs.</p>
          <div className={styles.dlInfo}>
            <div className={styles.dlInfoRow}><span>Package</span><span>Installer (.exe)</span></div>
            <div className={styles.dlInfoRow}><span>Architecture</span><span>x86_64</span></div>
            <div className={styles.dlInfoRow}><span>Runtime</span><span>Self-contained</span></div>
            <div className={styles.dlInfoRow}><span>Downloads</span><span>{releaseInfo.winX64}</span></div>
          </div>
          <div className={styles.dlActions}>
            <a className={`${styles.btn} ${styles.btnAccent}`} href="https://github.com/Raoufbaa/EEflasher-Release/releases/latest/download/EEFlasher_Setup.exe">
              <ArrowDown size={14} /> Download Installer
            </a>
            <a className={styles.btnPortable} href="https://github.com/Raoufbaa/EEflasher-Release/releases/latest/download/EEFlasher-win-x64.zip">
              <ArrowDown size={14} /> Portable ZIP
            </a>
          </div>
        </div>

        {/* Windows x86 Card */}
        <div className={styles.dlCard}>
          <div className={styles.dlTop}>
            <h3>Windows x86</h3>
            <span className={`${styles.tag} ${styles.tagGray}`}>Legacy</span>
          </div>
          <p className={styles.dlSub}>For 32-bit Windows systems or environments that require x86 support.</p>
          <div className={styles.dlInfo}>
            <div className={styles.dlInfoRow}><span>Package</span><span>Installer (.exe)</span></div>
            <div className={styles.dlInfoRow}><span>Architecture</span><span>x86 (32-bit)</span></div>
            <div className={styles.dlInfoRow}><span>Runtime</span><span>Self-contained</span></div>
            <div className={styles.dlInfoRow}><span>Downloads</span><span>{releaseInfo.winX86}</span></div>
          </div>
          <div className={styles.dlActions}>
            <a className={`${styles.btn} ${styles.btnGhost}`} href="https://github.com/Raoufbaa/EEflasher-Release/releases/latest/download/EEFlasher_Setup_x86.exe">
              <ArrowDown size={14} /> Download Installer
            </a>
            <a className={styles.btnPortable} href="https://github.com/Raoufbaa/EEflasher-Release/releases/latest/download/EEFlasher-win-x86.zip">
              <ArrowDown size={14} /> Portable ZIP
            </a>
          </div>
        </div>

        {/* Linux x64 Card */}
        <div className={styles.dlCard}>
          <div className={styles.dlTop}>
            <h3>Linux x64</h3>
            <span className={`${styles.tag} ${styles.tagGray}`}>Portable</span>
          </div>
          <p className={styles.dlSub}>Portable archive for 64-bit Linux. Extract and run — no installer needed.</p>
          <div className={styles.dlInfo}>
            <div className={styles.dlInfoRow}><span>Package</span><span>TAR.GZ</span></div>
            <div className={styles.dlInfoRow}><span>Architecture</span><span>x86_64</span></div>
            <div className={styles.dlInfoRow}><span>Runtime</span><span>Self-contained</span></div>
            <div className={styles.dlInfoRow}><span>Downloads</span><span>{releaseInfo.linuxX64}</span></div>
          </div>
          <div className={styles.dlActions}>
            <a className={styles.btnPortable} href="https://github.com/Raoufbaa/EEflasher-Release/releases/latest/download/EEFlasher-linux-x64.tar.gz">
              <ArrowDown size={14} /> Download TAR.GZ
            </a>
          </div>
        </div>
      </div>

      {/* Comparisons and Metadata */}
      <div className={styles.twoCol}>
        <div className={styles.panel}>
          <h3>Release details</h3>
          <div className={styles.statList}>
            <div className={styles.statRow}><span className={styles.label}>Version</span><span className={styles.value}>{releaseInfo.name}</span></div>
            <div className={styles.statRow}><span className={styles.label}>Published</span><span className={styles.value}>{releaseInfo.date}</span></div>
            <div className={styles.statRow}><span className={styles.label}>Total downloads</span><span className={`${styles.value} ${styles.check}`}>{releaseInfo.totalDl}</span></div>
            <div className={styles.statRow}><span className={styles.label}>Framework</span><span className={styles.value}>.NET 10 / Avalonia 12</span></div>
            <div className={styles.statRow}><span className={styles.label}>License</span><span className={styles.value}>MIT</span></div>
            <div className={styles.statRow}><span className={styles.label}>Status</span><span className={`${styles.value} ${styles.check}`}>Active development</span></div>
          </div>
        </div>

        <div className={styles.panel}>
          <h3>Why EEFlasher over AsProgrammer</h3>
          <div className={styles.statList}>
            <div className={styles.statRow}><span className={styles.label}>Write speed (4 MB)</span><span className={`${styles.value} ${styles.check}`}>~56 s vs ~5 min</span></div>
            <div className={styles.statRow}><span className={styles.label}>Architecture</span><span className={styles.value}>32-bit &amp; 64-bit</span></div>
            <div className={styles.statRow}><span className={styles.label}>Hex editor</span><span className={styles.value}>Advanced + undo/redo</span></div>
            <div className={styles.statRow}><span className={styles.label}>UEFI parser</span><span className={`${styles.value} ${styles.check}`}>Included</span></div>
            <div className={styles.statRow}><span className={styles.label}>Stop button</span><span className={`${styles.value} ${styles.check}`}>All operations</span></div>
          </div>
        </div>
      </div>

      {/* Features list */}
      <div className={styles.divider} id="features">Key Features</div>
      
      <div className={styles.threeCol}>
        <div className={styles.featureItem}>
          <div className={styles.fIcon}><Cpu size={16} /></div>
          <h4>Multi-hardware support</h4>
          <p>CH341A, CH347, Arduino, AVRISP MKII, USBAsp — auto-detection and hot-plug ready.</p>
        </div>

        <div className={styles.featureItem}>
          <div className={styles.fIcon}><Activity size={16} /></div>
          <h4>Protocol coverage</h4>
          <p>SPI25, SPI45 DataFlash, I2C EEPROM (24-series), and Microwire EEPROM (93-series).</p>
        </div>

        <div className={styles.featureItem}>
          <div className={styles.fIcon}><DbIcon size={16} /></div>
          <h4>Chip database</h4>
          <p>760+ chips from Winbond, Macronix, GigaDevice, ISSI, Spansion, Micron, and more.</p>
        </div>

        <div className={styles.featureItem}>
          <div className={styles.fIcon}><Terminal size={16} /></div>
          <h4>Hex editor</h4>
          <p>Live editing, undo/redo, search, go-to-address, and support for files up to 256 MB.</p>
        </div>

        <div className={styles.featureItem}>
          <div className={styles.fIcon}><ShieldAlert size={16} /></div>
          <h4>Write protection unlock</h4>
          <p>One-click unlock for SPI25 and SPI45 chips with detailed status register readout.</p>
        </div>

        <div className={styles.featureItem}>
          <div className={styles.fIcon}><Info size={16} /></div>
          <h4>UEFI capsule parser</h4>
          <p>Parse and extract UEFI firmware structures with tree view, GUIDs, and section metadata.</p>
        </div>
      </div>

      {/* Supported Hardware Table */}
      <div className={styles.hwPanel} id="hardware">
        <h3>Supported hardware interface adapters</h3>
        <table className={styles.table}>
          <thead>
            <tr><th>Device</th><th>Status</th><th>Protocols</th><th>32-bit</th><th>64-bit</th></tr>
          </thead>
          <tbody>
            <tr><td>CH341A</td><td><span className={styles.check}>✓ Supported</span></td><td>SPI, I2C, Microwire</td><td className={styles.check}>✓</td><td className={styles.check}>✓</td></tr>
            <tr><td>CH347</td><td><span class={styles.check}>✓ Supported</span></td><td>SPI, I2C, Microwire</td><td className={styles.check}>✓</td><td className={styles.check}>✓</td></tr>
            <tr><td>Arduino</td><td><span class={styles.check}>✓ Supported</span></td><td>SPI</td><td className={styles.check}>✓</td><td className={styles.check}>✓</td></tr>
            <tr><td>AVRISP MKII</td><td><span class={styles.check}>✓ Supported</span></td><td>SPI, ISP</td><td className={styles.check}>✓</td><td className={styles.check}>✓</td></tr>
            <tr><td>USBAsp</td><td><span class={styles.check}>✓ Supported</span></td><td>SPI</td><td className={styles.check}>✓</td><td className={styles.check}>✓</td></tr>
            <tr><td>Bus Pirate</td><td><span class={styles.plan}>⏳ Planned</span></td><td>SPI, I2C</td><td>—</td><td>—</td></tr>
            <tr><td>FT232H</td><td><span class={styles.plan}>⏳ Planned</span></td><td>SPI, I2C</td><td>—</td><td>—</td></tr>
          </tbody>
        </table>
      </div>

      {/* System Requirements Grid */}
      <div className={styles.reqGrid}>
        <div className={styles.reqCard}>
          <div className={styles.reqCardHead}>
            <div className={styles.reqCardIcon}><Monitor size={15} /></div>
            <h3>System requirements</h3>
          </div>
          <div className={styles.reqRows}>
            <div className={styles.reqRow}>
              <div className={styles.reqRowIcon}><Monitor size={12} /></div>
              <div className={styles.reqRowText}><strong>Windows 10 / 11</strong><span>32-bit (x86) or 64-bit (x64) builds available</span></div>
            </div>
            <div className={styles.reqRow}>
              <div className={styles.reqRowIcon}><Activity size={12} /></div>
              <div className={styles.reqRowText}><strong>Linux x64</strong><span>Portable TAR.GZ archive, extract and run</span></div>
            </div>
            <div className={styles.reqRow}>
              <div className={styles.reqRowIcon}><Check size={12} /></div>
              <div className={styles.reqRowText}><strong>No .NET runtime needed</strong><span>Self-contained build bundles everything</span></div>
            </div>
            <div className={styles.reqRow}>
              <div className={styles.reqRowIcon}><Info size={12} /></div>
              <div className={styles.reqRowText}><strong>CH341A / CH347 vendor drivers</strong><span>Required only for those specific devices</span></div>
            </div>
          </div>
        </div>

        <div className={styles.reqCard}>
          <div className={styles.reqCardHead}>
            <div className={styles.reqCardIcon}><Info size={15} /></div>
            <h3>Before you install</h3>
          </div>
          <div className={styles.reqRows}>
            <div className={styles.reqRow}>
              <div className={styles.reqRowIcon}><Terminal size={12} /></div>
              <div className={styles.reqRowText}><strong>Close competing software</strong><span>Quit AsProgrammer or NeoProgrammer before connecting</span></div>
            </div>
            <div className={styles.reqRow}>
              <div className={styles.reqRowIcon}><Check size={12} /></div>
              <div className={styles.reqRowText}><strong>Verify driver in Device Manager</strong><span>Confirm device shows after driver install</span></div>
            </div>
            <div className={styles.reqRow}>
              <div className={styles.reqRowIcon}><ShieldAlert size={12} /></div>
              <div className={styles.reqRowText}><strong>Unlock before writing</strong><span>Use the Unlock button if write or erase fails</span></div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className={styles.footer}>
        <div>© {new Date().getFullYear()} EEFlasher — built for the hardware and firmware community.</div>
        <div className={styles.footerLinks}>
          <a href="https://github.com/Raoufbaa/EEflasher-Release/releases" target="_blank" rel="noopener noreferrer">All Releases</a>
          <a href="https://github.com/Raoufbaa/EEflasher-Release" target="_blank" rel="noopener noreferrer">Source Code</a>
          <a href="https://github.com/Raoufbaa/EEflasher-Release/blob/main/README.md" target="_blank" rel="noopener noreferrer">Documentation</a>
        </div>
      </footer>
    </main>
  );
}
