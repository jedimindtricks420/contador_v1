import { NextResponse } from "next/server";
import { encrypt } from "@/lib/auth";
import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();

    const user = await prisma.user.findUnique({
      where: { email },
      include: { organizations: true }
    });

    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return NextResponse.json({ error: "Неверный логин или пароль" }, { status: 401 });
    }

    if (user.organizations.length === 0) {
      // New user — no orgs yet, send to onboarding
      const expires = new Date(Date.now() + 24 * 60 * 60 * 1000)
      const session = await encrypt({
        user: { id: user.id, email: user.email },
        expires,
      })
      const response = NextResponse.json({ success: true, redirect: '/onboarding/step-1' })
      response.cookies.set('session', session, { expires, httpOnly: true, secure: false })
      return response
    }

    // Default to the first organization for now
    const organizationId = user.organizations[0].id;

    // Update active_org_id in DB if it's not set or different
    if (user.active_org_id !== organizationId) {
      await prisma.user.update({
        where: { id: user.id },
        data: { active_org_id: organizationId }
      });
    }

    const expires = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const session = await encrypt({ 
      user: { id: user.id, email: user.email }, 
      organizationId,
      expires 
    });

    const response = NextResponse.json({ success: true, user: { name: user.name } });
    
    response.cookies.set("session", session, { 
      expires, 
      httpOnly: true,
      secure: false
    });

    // Also set organizationId cookie for frontend state
    response.cookies.set("organizationId", organizationId, {
      expires,
      httpOnly: false,
      secure: false
    });

    return response;
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}
