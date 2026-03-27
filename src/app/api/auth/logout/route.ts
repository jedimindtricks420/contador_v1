import { NextResponse } from 'next/server'

export async function POST() {
  const response = NextResponse.json({ success: true, message: 'Logged out' })
  
  response.cookies.delete('session')
  response.cookies.delete('organizationId')
  
  return response
}
