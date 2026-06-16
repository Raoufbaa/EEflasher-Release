// In-memory rate limiter for Next.js API routes

const tracker = new Map();

// Run pruning every 2 minutes to clear memory of expired entries
if (!global.rateLimitInterval) {
  global.rateLimitInterval = setInterval(() => {
    const now = Date.now();
    for (const [ip, record] of tracker.entries()) {
      if (now > record.resetTime) {
        tracker.delete(ip);
      }
    }
  }, 120000);
}

/**
 * Checks if a client IP has exceeded their request quota
 * @param {string} ip The client's IP address
 * @param {number} limit Number of allowed requests in the window
 * @param {number} windowMs Window duration in milliseconds (default: 60s)
 * @returns {{success: boolean, remaining: number, resetTime: number}}
 */
export function rateLimit(ip, limit = 60, windowMs = 60000) {
  const now = Date.now();
  const record = tracker.get(ip);

  if (!record) {
    tracker.set(ip, {
      count: 1,
      resetTime: now + windowMs,
    });
    return {
      success: true,
      remaining: limit - 1,
      resetTime: now + windowMs,
    };
  }

  if (now > record.resetTime) {
    // Reset window
    record.count = 1;
    record.resetTime = now + windowMs;
    return {
      success: true,
      remaining: limit - 1,
      resetTime: now + windowMs,
    };
  }

  if (record.count >= limit) {
    return {
      success: false,
      remaining: 0,
      resetTime: record.resetTime,
    };
  }

  record.count += 1;
  return {
    success: true,
    remaining: limit - record.count,
    resetTime: record.resetTime,
  };
}

/**
 * Helper to get client IP from Next.js request
 * @param {Request} req 
 * @returns {string}
 */
export function getClientIp(req) {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  return req.headers.get('x-real-ip') || '127.0.0.1';
}
