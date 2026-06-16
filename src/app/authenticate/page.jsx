'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import styles from '@/styles/Authenticate.module.css';

export default function Authenticate() {
  const [mode, setMode] = useState('login'); // 'login' or 'register'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const router = useRouter();

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    if (mode === 'login') {
      try {
        const res = await signIn('credentials', {
          email,
          password,
          redirect: false,
        });

        if (res?.error) {
          setError(res.error || 'Invalid credentials. Please try again.');
          setLoading(false);
        } else {
          setSuccess('Login successful! Redirecting...');
          router.replace('/database');
          router.refresh();
        }
      } catch (err) {
        console.error('Login error:', err);
        setError('An unexpected error occurred during login.');
        setLoading(false);
      }
    } else {
      // Register mode
      try {
        const res = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
        });

        const data = await res.json();

        if (!res.ok) {
          setError(data.error || 'Failed to register account.');
          setLoading(false);
        } else {
          setSuccess(data.message || 'Registration successful! You can now log in.');
          setMode('login');
          setPassword('');
          setLoading(false);
        }
      } catch (err) {
        console.error('Registration error:', err);
        setError('An unexpected error occurred during registration.');
        setLoading(false);
      }
    }
  }

  return (
    <div className={styles.authPage}>
      <div className={styles.authCard}>
        <h2>{mode === 'login' ? 'Welcome Back' : 'Create Uploader Account'}</h2>
        <p className={styles.authSubtitle}>
          {mode === 'login' 
            ? 'Sign in to upload and manage device firmwares' 
            : 'Register as an authorized firmware uploader'}
        </p>

        {/* Toggler */}
        <div className={styles.selectorContainer}>
          <button 
            type="button" 
            className={`${styles.selectorBtn} ${mode === 'login' ? styles.selectorBtnActive : ''}`}
            onClick={() => {
              setMode('login');
              setError('');
              setSuccess('');
            }}
          >
            Login
          </button>
          <button 
            type="button" 
            className={`${styles.selectorBtn} ${mode === 'register' ? styles.selectorBtnActive : ''}`}
            onClick={() => {
              setMode('register');
              setError('');
              setSuccess('');
            }}
          >
            Register
          </button>
        </div>

        {error && <div className={styles.errorAlert}>{error}</div>}
        {success && <div className={styles.successAlert}>{success}</div>}

        <form onSubmit={handleSubmit}>
          <div className={styles.formGroup}>
            <label htmlFor="email">Email Address</label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="e.g. admin@example.com"
              disabled={loading}
            />
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              disabled={loading}
            />
          </div>

          <button type="submit" className={styles.submitBtn} disabled={loading}>
            {loading && <div className={styles.spinner} />}
            <span>{mode === 'login' ? 'Sign In' : 'Register'}</span>
          </button>
        </form>
      </div>
    </div>
  );
}
