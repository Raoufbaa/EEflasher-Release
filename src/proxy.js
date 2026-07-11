import { getToken } from 'next-auth/jwt';
import { NextResponse } from 'next/server';

export default async function proxy(req) {
  const token = await getToken({
    req,
    secret: process.env.NEXTAUTH_SECRET,
    secureCookie: process.env.NODE_ENV === 'production',
  });

  const { pathname } = req.nextUrl;

  // If the user is authenticated and attempts to visit the authenticate page, redirect to '/'
  if (token && pathname === '/authenticate') {
    return NextResponse.redirect(new URL('/', req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/authenticate'],
};
