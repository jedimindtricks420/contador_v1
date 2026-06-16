import { NextRequest, NextResponse } from "next/server";
import { saveClosingState, getClosingState } from "@/lib/closing";
import prisma from "@/lib/prisma";
import { getActiveOrgId } from "@/lib/context";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ periodId: string; stepNumber: string }> }
) {
  try {
    const { periodId, stepNumber } = await params;
    const orgId = await getActiveOrgId();

    const period = await prisma.period.findFirst({ where: { id: periodId, orgId } });
    if (!period) {
      return NextResponse.json({ error: "Период не найден" }, { status: 404 });
    }

    const stepNum = parseInt(stepNumber);
    const body = await req.json();

    if (stepNum === 4) {
      await saveClosingState(periodId, {
        accruals: {
          salaryAmount: parseFloat(body.salaryAmount) || 0,
          depreciationAmount: parseFloat(body.depreciationAmount) || 0,
          rentAmount: parseFloat(body.rentAmount) || 0
        }
      });
    } else if (stepNum === 5) {
      await saveClosingState(periodId, {
        fxDiff: {
          exchangeRate: parseFloat(body.exchangeRate) || 0,
          difference: parseFloat(body.difference) || 0
        }
      });
    } else if (stepNum === 6) {
      await saveClosingState(periodId, {
        soliqMatched: {
          matched: parseInt(body.matched) || 0,
          unmatched: parseInt(body.unmatched) || 0
        }
      });
    }

    const nextStep = stepNum + 1;
    await saveClosingState(periodId, { currentStep: nextStep });

    const updated = await getClosingState(periodId);
    return NextResponse.json({ nextStep, summary: updated });
  } catch (err: any) {
    console.error("COMPLETE STEP ERROR:", err);
    return NextResponse.json({ error: err.message || "Internal error" }, { status: 500 });
  }
}
