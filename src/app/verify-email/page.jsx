'use client';

import { useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import styles from '@/styles/Authenticate.module.css';
import Image from 'next/image';

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  async function handleVerify(e) {
    if (e) e.preventDefault();
    if (!token) {
      setError('Verification token is missing. Please click the link from your email.');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const res = await fetch('/api/auth/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Verification failed. The link may be invalid or expired.');
      } else {
        setSuccess(data.message || 'Verification successful! You can now log in.');
      }
    } catch (err) {
      console.error('Verification request error:', err);
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.authCard}>
      <div style={{ textAlign: 'center', marginBottom: '20px' }}>
        <span style={{ fontSize: '1.1rem', fontWeight: '800', color: 'var(--white)', letterSpacing: '-0.03em', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
          <Image src="/Assets/EEFlasher.ico" alt="EEFlasher Logo" width={60} height={60} />
          <h3>Account Verification</h3>
          <p className={styles.authSubtitle}>
            Confirm your email to activate your firmware uploader account.
          </p>
        </span>
      </div>



      {error && <div className={styles.errorAlert}>{error}</div>}
      {success && <div className={styles.successAlert}>{success}</div>}

      {!success && (
        <form onSubmit={handleVerify}>
          <p style={{ fontSize: '0.86rem', color: 'var(--text)', textAlign: 'center', marginBottom: '24px', lineHeight: '1.5' }}>
            To prevent automatic link scanners from pre-fetching and consuming your token, click the button below to confirm your registration.
          </p>

          <button
            type="submit"
            className={styles.submitBtn}
            disabled={loading || !token}
            style={{ marginTop: '0px' }}
          >
            {loading && <div className={styles.spinner} />}
            <span>{loading ? 'Verifying...' : 'Confirm Verification'}</span>
          </button>
        </form>
      )}

      {success && (
        <Link href="/authenticate" className={styles.submitBtn} style={{ textDecoration: 'none', display: 'flex', marginTop: '0px', alignItems: 'center', justifyContent: 'center' }}>
          Go to Sign In
        </Link>
      )}

      {!token && !success && (
        <div style={{ marginTop: '20px', textAlign: 'center' }}>
          <Link href="/authenticate" style={{ fontSize: '0.84rem', color: 'var(--accent)', fontWeight: '600' }}>
            Back to Authentication
          </Link>
        </div>
      )}
    </div>
  );
}

export default function VerifyEmail() {
  return (
    <div className={styles.authPage}>
      <Suspense fallback={
        <div className={styles.authCard} style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', minHeight: '200px', gap: '12px' }}>
          <div className={styles.spinner} style={{ width: '32px', height: '32px' }} />
          <p style={{ color: 'var(--muted)', fontSize: '0.9rem' }}>Loading verification details...</p>
        </div>
      }>
        <VerifyEmailContent />
      </Suspense>
    </div>
  );
}
