import { NextRequest, NextResponse } from "next/server";
import { prismaWithOrg } from "@/lib/prisma";
import { getActiveOrgId } from "@/lib/context";
import { getOpenItemBufferAccountCodes } from "@/lib/ensureBaseData";
import { RISK_DAYS_BY_ACCOUNT, RISK_DAYS_DEFAULT } from "@/lib/constants";

/**
 * The list of accounts and their default deadlines is never hardcoded here — it's derived
 * from getOpenItemBufferAccountCodes() (every account any document type can open an OpenItem
 * on, per baseDocumentTypes) joined with the real Account.name from the chart of accounts, so
 * the UI always matches whatever the posting engine can actually create.
 */
export async function GET(req: NextRequest) {
  try {
    const orgId = await getActiveOrgId();
    if (!orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const org = await prismaWithOrg(orgId).organization.findUnique({
      where: { id: orgId },
      select: { settings: true },
    });

    const settings = (org?.settings as Record<string, any>) || {};
    const overrides = (settings.openItemDeadlines as Record<string, number>) || {};

    const codes = getOpenItemBufferAccountCodes();
    const accounts = await prismaWithOrg(orgId).account.findMany({
      where: { code: { in: codes } },
      select: { code: true, name: true },
    });
    const nameByCode = new Map(accounts.map((a) => [a.code, a.name]));

    const result = codes
      .map((code) => ({
        code,
        name: nameByCode.get(code) ?? code,
        days: overrides[code] ?? RISK_DAYS_BY_ACCOUNT[code] ?? RISK_DAYS_DEFAULT,
      }))
      .sort((a, b) => a.code.localeCompare(b.code));

    return NextResponse.json({ accounts: result });
  } catch (error) {
    console.error("GET /api/settings/open-item-deadlines error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const orgId = await getActiveOrgId();
    if (!orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const deadlines = await req.json();
    if (!deadlines || typeof deadlines !== "object" || Array.isArray(deadlines)) {
      return NextResponse.json({ error: "Ожидается объект { код_счёта: дни }" }, { status: 400 });
    }

    // Only accept overrides for accounts the posting engine can actually open OpenItems on —
    // rejects stray/typo'd codes instead of silently persisting dead configuration.
    const validCodes = new Set(getOpenItemBufferAccountCodes());
    for (const [code, days] of Object.entries(deadlines)) {
      if (!validCodes.has(code)) {
        return NextResponse.json({ error: `Счёт ${code} не используется как буферный счёт открытых позиций` }, { status: 400 });
      }
      if (typeof days !== "number" || !Number.isFinite(days) || days <= 0) {
        return NextResponse.json({ error: `Некорректный срок для счёта ${code}: ожидается положительное число дней` }, { status: 400 });
      }
    }

    const org = await prismaWithOrg(orgId).organization.findUnique({
      where: { id: orgId },
      select: { settings: true },
    });

    const settings = (org?.settings as Record<string, any>) || {};
    const updatedSettings = {
      ...settings,
      openItemDeadlines: { ...(settings.openItemDeadlines || {}), ...deadlines },
    };

    await prismaWithOrg(orgId).organization.update({
      where: { id: orgId },
      data: { settings: updatedSettings },
    });

    return NextResponse.json({ openItemDeadlines: updatedSettings.openItemDeadlines });
  } catch (error) {
    console.error("PATCH /api/settings/open-item-deadlines error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
