import { GovernedWorkflow, type RiskLevel } from "../index.js";
import { RiskApprovalPolicy, type ApprovalRoute } from "../policy.js";

export type FinancePaymentState =
  | "received"
  | "review"
  | "approval_pending"
  | "approved"
  | "scheduled"
  | "paid"
  | "rejected"
  | "cancelled";

export const financePaymentTransitions: Record<FinancePaymentState, readonly FinancePaymentState[]> = {
  received: ["review", "cancelled"],
  review: ["approval_pending", "rejected", "cancelled"],
  approval_pending: ["approved", "rejected", "cancelled"],
  approved: ["scheduled", "cancelled"],
  scheduled: ["paid", "cancelled"],
  paid: [],
  rejected: [],
  cancelled: [],
};

export const financeApprovalRoutes: readonly ApprovalRoute[] = [
  {
    id: "finance-manager",
    minimumRisk: "medium",
    requiredApprovers: 1,
    description: "Finance manager review for non-routine payment requests.",
  },
  {
    id: "finance-controller",
    minimumRisk: "high",
    requiredApprovers: 2,
    description: "Controller plus delegated approver for high-risk payment changes.",
  },
  {
    id: "executive-finance",
    minimumRisk: "critical",
    requiredApprovers: 2,
    description: "Executive finance approval for critical exceptions, such as bank-account changes.",
  },
];

export function createFinancePaymentWorkflow(actor = "system"): GovernedWorkflow<FinancePaymentState> {
  return new GovernedWorkflow<FinancePaymentState>({
    initial: "received",
    transitions: financePaymentTransitions,
    actor,
    approvalPolicy: new RiskApprovalPolicy<FinancePaymentState>(financeApprovalRoutes),
  });
}

/** Use this helper to make risk declarations explicit at intake time. */
export function paymentRisk(input: {
  amount?: number;
  currency?: string;
  bankAccountChanged?: boolean;
  duplicateSuspected?: boolean;
}): RiskLevel {
  if (input.bankAccountChanged || input.duplicateSuspected) return "critical";
  if ((input.amount ?? 0) >= 100_000) return "high";
  if ((input.amount ?? 0) >= 10_000) return "medium";
  return "low";
}
