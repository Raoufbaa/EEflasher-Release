'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import styles from '@/styles/Navbar.module.css';

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
      
      <div className={styles.navLinks}>
        <Link 
          href={isHome ? '#downloads' : '/#downloads'} 
          className={`${styles.navLink}`}
        >
          Downloads
        </Link>
        <Link 
          href={isHome ? '#features' : '/#features'} 
          className={`${styles.navLink}`}
        >
          Features
        </Link>
        <Link 
          href={isHome ? '#hardware' : '/#hardware'} 
          className={`${styles.navLink}`}
        >
          Hardware
        </Link>
        <Link 
          href="/database" 
          className={`${styles.navLink} ${pathname === '/database' ? styles.navActive : ''}`}
        >
          Database
        </Link>
        <a 
          href="https://github.com/Raoufbaa/EEflasher-Release" 
          target="_blank" 
          rel="noopener noreferrer" 
          className={styles.navLink}
        >
          GitHub
        </a>
        <a 
          href="https://github.com/Raoufbaa/EEflasher-Release/blob/main/README.md" 
          target="_blank" 
          rel="noopener noreferrer" 
          className={styles.navLink}
        >
          Docs
        </a>
      </div>

      <div className={styles.authContainer}>
        {status === 'loading' ? (
          <span style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>...</span>
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
    </nav>
  );
}
