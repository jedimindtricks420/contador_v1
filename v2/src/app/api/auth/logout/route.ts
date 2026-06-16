import { NextResponse } from "next/server";
import { COOKIE_NAME } from "@/lib/auth";

export async function POST() {
  const res = NextResponse.redirect(
    new URL("/v2/login", process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3032")
  );
  res.cookies.delete(COOKIE_NAME);
  return res;
}

export async function GET() {
  return POST();
}
