import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getActiveOrgId } from "@/lib/context";

export async function GET() {
  try {
    const orgId = await getActiveOrgId();
    const rules = await prisma.rule.findMany({
      where: { orgId },
      include: { documentType: { select: { name: true, code: true } } },
      orderBy: [{ order: "asc" }, { createdAt: "asc" }],
    });
    return NextResponse.json(rules);
  } catch (err: any) {
    if (err.message === "UNAUTHORIZED" || err.message === "NO_ACTIVE_ORG") {
      return NextResponse.json({ error: err.message }, { status: 401 });
    }
    return NextResponse.json({ error: "Внутренняя ошибка сервера" }, { status: 500 });
  }
}

const VALID_MATCH_TYPES = ["INN", "KEYWORD", "AMOUNT_RANGE", "TREASURY_ACCOUNT"];

export async function POST(req: NextRequest) {
  try {
    const orgId = await getActiveOrgId();
    const { matchType, matchValue, categoryId, direction } = await req.json();

    if (!matchType || !matchValue || !categoryId) {
      return NextResponse.json({ error: "matchType, matchValue, categoryId обязательны" }, { status: 400 });
    }

    if (!VALID_MATCH_TYPES.includes(matchType)) {
      return NextResponse.json({ error: `Недопустимый тип правила. Допустимые: ${VALID_MATCH_TYPES.join(", ")}` }, { status: 400 });
    }

    const rule = await prisma.rule.create({
      data: {
        orgId, matchType, matchValue, categoryId, createdFrom: "MANUAL",
        direction: direction || null
      },
    });
    return NextResponse.json(rule, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: "Внутренняя ошибка сервера" }, { status: 500 });
  }
}
