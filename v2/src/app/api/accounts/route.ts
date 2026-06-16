import { NextRequest, NextResponse } from "next/server";
import prisma, { prismaWithOrg } from "@/lib/prisma";
import { getActiveOrgId } from "@/lib/context";

export async function GET(req: NextRequest) {
  try {
    const orgId = await getActiveOrgId();
    if (!orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const searchParams = req.nextUrl.searchParams;
    const search = searchParams.get("search")?.toLowerCase() || "";
    const showHidden = searchParams.get("showHidden") === "true";

    // Get organization's hidden accounts
    const org = await prismaWithOrg(orgId).organization.findUnique({
      where: { id: orgId },
      select: { settings: true }
    });
    
    const settings = (org?.settings as Record<string, any>) || {};
    const hiddenAccountIds: string[] = settings.hiddenAccounts || [];

    // Fetch all accounts
    const accounts = await prisma.account.findMany({
      orderBy: { code: "asc" },
      include: {
        _count: {
          select: { journalEntries: true, openItems: true }
        }
      }
    });

    // Build hierarchy
    const accountMap = new Map<string, any>();
    const roots: any[] = [];

    accounts.forEach(acc => {
      accountMap.set(acc.id, {
        ...acc,
        isHidden: hiddenAccountIds.includes(acc.id),
        usageCount: acc._count.journalEntries + acc._count.openItems,
        children: []
      });
    });

    accounts.forEach(acc => {
      const node = accountMap.get(acc.id);
      if (acc.parentId) {
        const parent = accountMap.get(acc.parentId);
        if (parent) {
          parent.children.push(node);
        } else {
          roots.push(node);
        }
      } else {
        roots.push(node);
      }
    });

    // Filter by search and visibility
    const filterNode = (node: any): any | null => {
      // Filter out hidden if not requested
      if (!showHidden && node.isHidden) return null;

      // Filter by search
      const matchesSearch = !search || 
        node.code.toLowerCase().includes(search) || 
        node.name.toLowerCase().includes(search);

      // Filter children
      const filteredChildren = node.children
        .map(filterNode)
        .filter(Boolean);

      if (!matchesSearch && filteredChildren.length === 0) {
        return null; // Node doesn't match and has no matching children
      }

      return {
        ...node,
        children: filteredChildren
      };
    };

    const result = roots.map(filterNode).filter(Boolean);

    return NextResponse.json(result);
  } catch (error) {
    console.error("GET /api/accounts error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
