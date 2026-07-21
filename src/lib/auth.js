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
 * Resilient check if user has admin privileges.
 * Handles boolean true, string 'true', number 1, or string 't'.
 */
export function checkIsAdmin(userOrValue) {
  if (userOrValue === undefined || userOrValue === null) return false;
  const val = typeof userOrValue === 'object' ? userOrValue.is_admin : userOrValue;
  return val === true || val === 'true' || val === 1 || val === 't';
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
