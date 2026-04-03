import { type NextRequest, NextResponse } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;

  // Skip middleware for public routes and API routes
  if (
    path === '/' ||
    path === '/login' ||
    path === '/register' ||
    path === '/onboarding' ||
    path === '/offline' ||
    path.startsWith('/api/') ||
    path.startsWith('/manifest') ||
    path.startsWith('/sw')
  ) {
    return NextResponse.next();
  }

  try {
    return await updateSession(request);
  } catch {
    // If session update fails, continue anyway — pages handle their own auth
    return NextResponse.next();
  }
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
