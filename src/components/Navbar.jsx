'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import styles from '@/styles/Navbar.module.css';
import { Download, Zap, Cpu, Database } from 'lucide-react';

export default function Navbar() {
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  const isHome = pathname === '/';

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Close dropdown when changing route
  useEffect(() => {
    const timer = setTimeout(() => {
      setDropdownOpen(false);
    }, 0);
    return () => clearTimeout(timer);
  }, [pathname]);

  // Hide Navbar if on /authenticate and not authenticated
  if (pathname === '/authenticate' && !session && status !== 'loading') {
    return null;
  }

  return (
    <nav className={styles.navbar}>
      <Link href="/" className={styles.navBrand}>
        <img src="/Assets/EEFlasher.ico" alt="EEFlasher Logo" />
        <span>EEFlasher</span>
      </Link>

      <div className={styles.navLinksLeft}>
        <Link
          href={isHome ? '#downloads' : '/#downloads'}
          className={styles.navLink}
        >
          <Download size={20} className={styles.navIcon} />
          <span className={styles.navText}>Downloads</span>
        </Link>
        <Link
          href={isHome ? '#features' : '/#features'}
          className={styles.navLink}
        >
          <Zap size={20} className={styles.navIcon} />
          <span className={styles.navText}>Features</span>
        </Link>
      </div>

      <div className={styles.authContainer}>
        {status === 'loading' ? (
          <span className={styles.loadingDots}>...</span>
        ) : session ? (
          <div className={styles.dropdownContainer} ref={dropdownRef}>
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className={styles.avatarBtn}
              aria-expanded={dropdownOpen}
              title="View account"
            >
              <img
                src={'/api/user/avatar?t=' + encodeURIComponent(session.user.profile_image || '')}
                alt={`${session.user.name || 'User'}'s Profile`}
                className={styles.avatarImg}
              />
            </button>

            {dropdownOpen && (
              <div className={styles.dropdownMenu}>
                <div className={styles.dropdownHeader}>
                  <img
                    src={'/api/user/avatar?t=' + encodeURIComponent(session.user.profile_image || '')}
                    alt="Dropdown Avatar"
                    className={styles.dropdownAvatar}
                  />
                  <div className={styles.dropdownUserDetail}>
                    <span className={styles.dropdownName}>{session.user.name || 'Uploader'}</span>
                    <span className={styles.dropdownEmail}>{session.user.email}</span>
                  </div>
                </div>

                <div className={styles.dropdownBadges}>
                  {session.user.is_admin ? (
                    <span className={`${styles.dropdownBadge} ${styles.badgeAdmin}`}>
                      🛡️ System Admin
                    </span>
                  ) : (
                    <span className={`${styles.dropdownBadge} ${styles.badgeUploader}`}>
                      👤 Uploader
                    </span>
                  )}

                  {session.user.verified !== false ? (
                    <span className={`${styles.dropdownBadge} ${styles.badgeVerified}`}>
                      ✓ Account Verified
                    </span>
                  ) : (
                    <span className={`${styles.dropdownBadge} ${styles.badgePending}`}>
                      ⏳ Verification Pending
                    </span>
                  )}
                </div>

                <div className={styles.dropdownDivider} />
                <button
                  onClick={() => signOut({ callbackUrl: '/' })}
                  className={styles.dropdownLogoutBtn}
                >
                  Logout
                </button>
              </div>
            )}
          </div>
        ) : (
          <Link href="/authenticate" className={styles.authBtn}>
            Login
          </Link>
        )}
      </div>

      <div className={styles.navLinksRight}>
        <Link
          href={isHome ? '#hardware' : '/#hardware'}
          className={styles.navLink}
        >
          <Cpu size={20} className={styles.navIcon} />
          <span className={styles.navText}>Hardware</span>
        </Link>
        <Link
          href="/database"
          className={`${styles.navLink} ${pathname === '/database' ? styles.navActive : ''}`}
        >
          <Database size={20} className={styles.navIcon} />
          <span className={styles.navText}>Database</span>
        </Link>
      </div>
    </nav>
  );
}

