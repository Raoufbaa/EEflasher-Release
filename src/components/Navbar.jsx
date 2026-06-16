'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import styles from '@/styles/Navbar.module.css';

export default function Navbar() {
  const pathname = usePathname();
  const { data: session, status } = useSession();

  const isHome = pathname === '/';

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
          <>
            <div className={styles.authInfo}>
              <strong>{session.user.email}</strong>
              <span>Uploader</span>
            </div>
            <button 
              onClick={() => signOut({ callbackUrl: '/' })} 
              className={`${styles.authBtn} ${styles.authBtnGhost}`}
            >
              Logout
            </button>
          </>
        ) : (
          <Link href="/authenticate" className={styles.authBtn}>
            Login
          </Link>
        )}
      </div>
    </nav>
  );
}
