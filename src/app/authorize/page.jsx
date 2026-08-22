'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import styles from '@/styles/Authorize.module.css';

function AuthorizeContent() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();

  const state = searchParams.get('state') || '';
  const redirectUri = searchParams.get('redirect_uri') || 'http://127.0.0.1:56321/auth/callback';
  const currentEmailParam = searchParams.get('current_email') || '';

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [authorized, setAuthorized] = useState(false);
  const [desktopOnline, setDesktopOnline] = useState(null);
  const [desktopUserEmail, setDesktopUserEmail] = useState(currentEmailParam);
  const [secondsLeft, setSecondsLeft] = useState(300); // 5 minutes (300 seconds)
  const [isExpired, setIsExpired] = useState(false);

  useEffect(() => {
    if (status === 'unauthenticated') {
      const fullCallback = `/authorize?${searchParams.toString()}`;
      router.replace(`/authenticate?callbackUrl=${encodeURIComponent(fullCallback)}`);
    }
  }, [status, router, searchParams]);

  // 5-minute countdown timer
  useEffect(() => {
    if (authorized) return;

    const interval = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          setIsExpired(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [authorized]);

  // Check desktop app connection status and current logged in desktop user on load
  useEffect(() => {
    let isMounted = true;
    async function checkDesktopHealth() {
      try {
        const res = await fetch('http://127.0.0.1:56321/health', {
          method: 'GET',
          headers: { Accept: 'application/json' },
          signal: AbortSignal.timeout(2000)
        });
        if (res.ok) {
          const data = await res.json();
          if (isMounted && data.status === 'ok') {
            setDesktopOnline(true);
            if (data.userEmail) {
              setDesktopUserEmail(data.userEmail);
            }
            return;
          }
        }
      } catch (e) { }
      if (isMounted) {
        setDesktopOnline(false);
      }
    }
    checkDesktopHealth();
    return () => { isMounted = false; };
  }, []);

  if (status === 'loading' || status === 'unauthenticated') {
    return (
      <div className={styles.authPage}>
        <div className={styles.authCard} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minHeight: '220px', gap: '14px' }}>
          <div className="spinner" style={{ width: '36px', height: '36px' }} />
          <p style={{ color: 'var(--muted)', fontSize: '0.95rem' }}>Checking authorization session...</p>
        </div>
      </div>
    );
  }

  const user = session?.user;
  const userPlan = (user?.plan || 'FREE').toUpperCase();

  function formatCountdown(sec) {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }

  async function handleAuthorize() {
    if (isExpired || secondsLeft <= 0) {
      setError('Authorization session expired (5 min limit). Please restart authorization from EEFlasher.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Step 1: Generate encrypted token from Next.js server
      const res = await fetch('/api/auth/desktop-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const data = await res.json();

      if (!res.ok || !data.token) {
        setError(data.error || 'Failed to authorize desktop application.');
        setLoading(false);
        return;
      }

      // Step 2: Send token directly to local EEFlasher desktop server and strictly verify acceptance
      const callbackUrl = new URL(redirectUri);
      callbackUrl.searchParams.set('token', data.token);
      if (state) {
        callbackUrl.searchParams.set('state', state);
      }

      let desktopResponse;
      try {
        desktopResponse = await fetch(callbackUrl.toString(), {
          method: 'GET',
          headers: { Accept: 'application/json' },
          signal: AbortSignal.timeout(5000)
        });
      } catch (netErr) {
        setLoading(false);
        setError('Cannot connect to EEFlasher Desktop (http://127.0.0.1:56321). The 5-minute authorization window may have elapsed or the desktop app is closed.');
        return;
      }

      if (!desktopResponse.ok) {
        setLoading(false);
        setError(`EEFlasher Desktop returned error (HTTP ${desktopResponse.status}). Please restart authorization from EEFlasher.`);
        return;
      }

      const desktopResult = await desktopResponse.json();
      if (desktopResult.status !== 'ok') {
        setLoading(false);
        setError(desktopResult.message || 'EEFlasher Desktop rejected the authorization token.');
        return;
      }

      // Desktop confirmed receipt and processing
      setLoading(false);
      setAuthorized(true);
    } catch (err) {
      console.error('Authorization error:', err);
      setError('Connection to EEFlasher Desktop failed. Ensure EEFlasher is open.');
      setLoading(false);
    }
  }

  function handleCancel() {
    router.replace('/database');
  }

  const planGradients = {
    ADMIN: 'linear-gradient(135deg, #ef4444, #f97316)',
    PRO: 'linear-gradient(135deg, #f59e0b, #06b6d4)',
    FREE: 'linear-gradient(135deg, rgba(255, 255, 255, 0.18), rgba(255, 255, 255, 0.06))'
  };

  const activeGradient = planGradients[userPlan] || planGradients.FREE;
  const isAccountSwitch = Boolean(desktopUserEmail && user?.email && desktopUserEmail.toLowerCase() !== user.email.toLowerCase());
  const hasTimer = !isExpired && secondsLeft > 0;

  if (authorized) {
    return (
      <div className={styles.authPage}>
        <div className={`${styles.authCard} ${styles.successCard}`}>
          <div className={styles.successIconBadge}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <h2 className={styles.successTitle}>
            Connected to EEFlasher!
          </h2>
          <p className={styles.successText}>
            Your account and <strong style={{ color: '#10b981' }}>{userPlan}</strong> subscription have been synchronized. You can now return to the EEFlasher desktop app.
          </p>
          <div className={styles.buttonRow}>
            <button
              onClick={() => router.replace('/database')}
              className={styles.dashboardBtn}
            >
              Go to Dashboard
            </button>
            <button
              onClick={() => {
                try { window.close(); } catch { }
              }}
              className={styles.doneBtn}
            >
              Done
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.authPage}>
      <div className={styles.authCard}>

        {/* Header with Real App Logo & Title */}
        <div className={styles.header}>
          <Image
            src="/Assets/EEFlasher.ico"
            alt="EEFlasher"
            width={60}
            height={60}
            className={styles.logo}
          />
          <h2 className={styles.title}>
            Connect to EEFlasher
          </h2>
          <p className={styles.subtitle}>
            Authorize desktop app access to your account and plan.
          </p>
        </div>

        {/* 100% Width Countdown Timer Bar (0 radius at bottom) with dynamic plan gradient */}
        {hasTimer ? (
          <div
            className={styles.tokenExpireBar}
            style={{ background: activeGradient }}
          >
            <span>Token expires in {formatCountdown(secondsLeft)}</span>
          </div>
        ) : (
          <div className={styles.tokenExpireBarExpired}>
            <span>Authorization Expired (5m limit)</span>
          </div>
        )}

        {/* Merged Unified Container: User Profile + Dashed Divider + Permissions */}
        <div
          className={hasTimer ? styles.infoContainerWithTimer : styles.infoContainerNoTimer}
          style={{
            background: `linear-gradient(var(--surface), var(--surface)) padding-box, ${activeGradient} border-box`
          }}
        >
          {/* Top: User Profile Info */}
          <div className={styles.userInfo}>
            <Image
              src={user?.profile_image || '/Assets/profile.jpg'}
              alt="Profile"
              width={44}
              height={44}
              className={styles.userAvatar}
            />
            <div className={styles.userDetails}>
              <div className={styles.userNameRow}>
                <span className={styles.userName}>
                  {user?.name || user?.email?.split('@')[0]}
                </span>
                <span className={styles.planBadge} style={{ background: activeGradient }}>
                  {userPlan}
                </span>
              </div>
              <div className={styles.userEmail}>
                {user?.email}
              </div>
            </div>
          </div>

          {/* Dashed Line Separator */}
          <div className={styles.dashedSeparator} />

          {/* Bottom: Permissions List */}
          <div className={styles.permissionsList}>
            <div className={styles.permissionsTitle}>
              This will allow EEFlasher Desktop to:
            </div>
            <div className={styles.permissionItem}>
              <span className={styles.checkMark}>✓</span> Verify active {userPlan} subscription features
            </div>
            <div className={styles.permissionItem} style={{ marginBottom: userPlan !== 'FREE' ? '4px' : '0' }}>
              <span className={styles.checkMark}>✓</span> Sync chip database & online firmware saves
            </div>
            {userPlan !== 'FREE' && (
              <div className={styles.permissionItem}>
                <span className={styles.checkMark}>✓</span> Unlock Clean &amp; Configure ME (CSME Builder)
              </div>
            )}
          </div>
        </div>

        {/* Account Switch Notice (No Emojis) */}
        {isAccountSwitch && (
          <div className={styles.accountSwitchAlert}>
            <div className={styles.accountSwitchTitle}>
              Account Change Detected
            </div>
            <div className={styles.alertConnected}>
              EEFlasher is currently connected as <span style={{ color: 'var(--foreground)', fontWeight: '600' }}>{desktopUserEmail}</span>.
            </div>
            <div className={styles.alertSwitching}>
              Click below to switch EEFlasher to <strong style={{ color: '#ffffff' }}>{user?.email}</strong> ({userPlan}).
            </div>
          </div>
        )}

        {isExpired && (
          <div className={styles.timeoutAlert}>
            <strong>Authorization timed out (5 min limit).</strong><br />
            The token has been invalidated and the desktop listener has shut down. Please return to EEFlasher and click <em>Connect Account</em> again.
          </div>
        )}

        {desktopOnline === false && !error && !isExpired && (
          <div className={styles.warningAlert}>
            EEFlasher desktop is not detected. Please ensure EEFlasher is running.
          </div>
        )}

        {error && (
          <div className={styles.errorAlert}>
            {error}
          </div>
        )}

        <div className={styles.buttonRow}>
          <button
            onClick={handleCancel}
            disabled={loading}
            className={styles.cancelButton}
          >
            {isExpired ? 'Close' : 'Cancel'}
          </button>
          <button
            onClick={handleAuthorize}
            disabled={loading || isExpired}
            className={(loading || isExpired) ? styles.disabledButton : styles.authorizeButton}
          >
            {loading ? (
              <>
                <span className="spinner" style={{ width: '15px', height: '15px' }} />
                {isAccountSwitch ? 'Switching Account...' : 'Authorizing...'}
              </>
            ) : isExpired ? (
              'Session Expired'
            ) : isAccountSwitch ? (
              'Switch & Authorize'
            ) : (
              'Authorize EEFlasher'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AuthorizePage() {
  return (
    <Suspense fallback={
      <div className={styles.authPage}>
        <div className={styles.authCard} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minHeight: '220px', gap: '14px' }}>
          <div className="spinner" style={{ width: '36px', height: '36px' }} />
          <p style={{ color: 'var(--muted)', fontSize: '0.95rem' }}>Loading authorization...</p>
        </div>
      </div>
    }>
      <AuthorizeContent />
    </Suspense>
  );
}
