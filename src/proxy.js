import { NextResponse } from 'next/server';
import { getAuthToken } from '@/lib/auth';

export default async function proxy(req) {
  const token = await getAuthToken(req);

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
