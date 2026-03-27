import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { decrypt } from './lib/auth'

const publicRoutes = ['/login', '/api/auth/login']

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Check if route is public
  if (publicRoutes.includes(pathname)) {
    return NextResponse.next()
  }

  // Get session
  const session = request.cookies.get('session')?.value

  if (!session) {
    // Redirect to login
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

    // Success - proceed
    const response = NextResponse.next()
    
    // Inject organization context if needed? 
    // Actually, we'll read it from the cookie/session in the API routes.
    
    return response

  } catch (error) {
    // Session invalid or expired
    const response = NextResponse.redirect(new URL('/login', request.url))
    response.cookies.delete('session')
    response.cookies.delete('organizationId')
    return response
  }
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}
