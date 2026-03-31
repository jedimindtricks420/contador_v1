import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { encrypt } from '@/lib/auth'

export async function POST(request: Request) {
  try {
    const { name, email, password } = await request.json()

    // Validation
    if (!email || !email.includes('@')) {
      return NextResponse.json({ error: 'Некорректный email' }, { status: 400 })
    }
    if (!password || password.length < 8) {
      return NextResponse.json({ error: 'Пароль должен содержать минимум 8 символов' }, { status: 400 })
    }

    // Check unique email
    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing) {
      return NextResponse.json({ error: 'Email уже зарегистрирован' }, { status: 409 })
    }

    // Hash password
    const password_hash = await bcrypt.hash(password, 12)

    // Create user (no org yet)
    const user = await prisma.user.create({
      data: {
        email,
        password_hash,
        name: name?.trim() || null,
        active_org_id: null,
      }
    })

    // Issue session JWT (no organizationId — will be set after onboarding)
    const expires = new Date(Date.now() + 24 * 60 * 60 * 1000)
    const session = await encrypt({
      user: { id: user.id, email: user.email },
      expires,
    })

    const response = NextResponse.json({ success: true })
    response.cookies.set('session', session, {
      expires,
      httpOnly: true,
      secure: false,
    })

    return response
  } catch (error: any) {
    console.error('Register error:', error)
    return NextResponse.json({ error: 'Ошибка сервера' }, { status: 500 })
  }
}
