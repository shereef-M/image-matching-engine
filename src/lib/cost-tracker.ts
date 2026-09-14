import { prisma } from "./prisma";
import type { CallType } from "@prisma/client";

export const BUDGET_USD = process.env.COST_BUDGET_USD
  ? Number(process.env.COST_BUDGET_USD)
  : 1.0;

export async function getTotalCostSoFar(): Promise<number> {
  const result = await prisma.costLogEntry.aggregate({
    _sum: { costUsd: true },
  });
  return result._sum.costUsd ?? 0;
}

/**
 * Checked BEFORE every AI call, not after — this is what makes the
 * budget guard actually stop the batch gracefully instead of finding
 * out it overspent once it's too late.
 */
export async function wouldExceedBudget(
  estimatedCost: number,
): Promise<boolean> {
  const soFar = await getTotalCostSoFar();
  return soFar + estimatedCost > BUDGET_USD;
}

export async function logCost(
  callType: CallType,
  refId: string,
  costUsd: number,
): Promise<void> {
  await prisma.costLogEntry.create({ data: { callType, refId, costUsd } });
}
