import { getToken } from 'next-auth/jwt';

/**
 * Robust helper to retrieve NextAuth token across production (HTTPS / Vercel __Secure- cookies)
 * and local development (HTTP / next-auth. cookies).
 */
export async function getAuthToken(req) {
  if (!req) return null;

  try {
    // 1. Standard retrieval relying on request headers/URL
    let token = await getToken({
      req,
      secret: process.env.NEXTAUTH_SECRET,
    });
    if (token) return token;

    // 2. Explicit attempt with secureCookie: true (Vercel HTTPS production)
    token = await getToken({
      req,
      secret: process.env.NEXTAUTH_SECRET,
      secureCookie: true,
    });
    if (token) return token;

    // 3. Explicit attempt with secureCookie: false (Local HTTP development)
    token = await getToken({
      req,
      secret: process.env.NEXTAUTH_SECRET,
      secureCookie: false,
    });
    return token;
  } catch (err) {
    console.error("Error retrieving auth token:", err);
    return null;
  }
}

/**
 * Resilient check to retrieve user's active Plan Tier ('FREE', 'PRO', or 'ADMIN').
 * Evaluates plan column and expiration dates.
 */
export function getUserPlan(userOrValue) {
  if (!userOrValue) return 'FREE';
  
  if (typeof userOrValue === 'string') {
    const p = userOrValue.toUpperCase();
    return (p === 'ADMIN' || p === 'PRO') ? p : 'FREE';
  }

  // 1. Direct plan check
  const planVal = (userOrValue.plan || '').toString().toUpperCase();
  if (planVal === 'ADMIN') {
    return 'ADMIN';
  }

  if (planVal === 'PRO') {
    // Check if subscription has expired
    if (userOrValue.plan_expires_at) {
      const expiry = new Date(userOrValue.plan_expires_at);
      if (!isNaN(expiry.getTime()) && expiry.getTime() < Date.now()) {
        return 'FREE'; // Subscription expired
      }
    }
    return 'PRO';
  }

  return 'FREE';
}

/**
 * Resilient check if user has admin privileges based on Plan === 'ADMIN'.
 */
export function checkIsAdmin(userOrValue) {
  if (userOrValue === undefined || userOrValue === null) return false;
  if (typeof userOrValue === 'object') {
    return (userOrValue.plan || '').toString().toUpperCase() === 'ADMIN';
  }
  return userOrValue.toString().toUpperCase() === 'ADMIN';
}

/**
 * Resilient check if user has active PRO or ADMIN tier.
 */
export function checkIsPro(userOrValue) {
  const plan = getUserPlan(userOrValue);
  return plan === 'PRO' || plan === 'ADMIN';
}

/**
 * Resilient check if user account is verified.
 * Handles boolean true, string 'true', or string 't'.
 * Rejects OTP code strings ('hash|expiry') and 'false'.
 */
export function checkIsVerified(userOrValue) {
  if (userOrValue === undefined || userOrValue === null) return false;
  const val = typeof userOrValue === 'object' ? userOrValue.verified : userOrValue;
  return val === true || val === 'true' || val === 't';
}
