import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { decrypt } from './lib/auth'

const publicRoutes = [
  '/',
  '/login',
  '/register',
  '/api/auth/login',
  '/api/auth/register',
  '/api/templates',
]

export async function middleware(request: NextRequest) {
  try {
    const response = await handleRequest(request);
    
    // Security Headers (Enterprise Hardening)
    response.headers.set('X-Frame-Options', 'DENY');
    response.headers.set('X-Content-Type-Options', 'nosniff');
    response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocations=()');
    
    return response;
  } catch (error) {
    const response = NextResponse.redirect(new URL('/login', request.url))
    response.cookies.delete('session')
    response.cookies.delete('organizationId')
    return response
  }
}

async function handleRequest(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Check if route is public
  if (publicRoutes.some(route => pathname === route || pathname.startsWith(route + '/'))) {
    return NextResponse.next()
  }

  // Get session
  const session = request.cookies.get('session')?.value

  if (!session) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.redirect(new URL('/login', request.url))
  }

  try {
    const parsed = await decrypt(session)
    const expires = new Date(parsed.expires)

    if (expires < new Date()) {
       throw new Error('Expired')
    }

    return NextResponse.next()
  } catch (error) {
    throw error // Let the outer catch handle it
  }
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.svg|.*\\.png).*)',
  ],
}
