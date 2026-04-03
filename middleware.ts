import { type NextRequest, NextResponse } from 'next/server';

export async function middleware(_request: NextRequest) {
  // All auth is handled by individual pages/API routes
  // Middleware just passes through
  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
