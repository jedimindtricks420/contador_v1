import { NextResponse } from 'next/server'
import { encrypt, getSession } from '@/lib/auth'

export async function POST(request: Request) {
  try {
    const { organizationId } = await request.json()
    const session = await getSession()
    
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Update session with new organizationId
    const expires = new Date(session.expires)
    const newSession = await encrypt({ 
      ...session,
      organizationId,
    })

    const response = NextResponse.json({ success: true })
    
    response.cookies.set("session", newSession, { 
      expires, 
      httpOnly: true,
      secure: false
    });

    response.cookies.set("organizationId", organizationId, {
      expires,
      httpOnly: false,
      secure: false
    });

    return response
  } catch (error: any) {
    return NextResponse.json({ error: 'Error switching organization' }, { status: 500 })
  }
}
