import type { RiskLevel } from "./index.js";

const riskRank: Record<RiskLevel, number> = {
  low: 0,
  medium: 1,
  high: 2,
  critical: 3,
};

export type ApprovalRoute = {
  readonly id: string;
  readonly minimumRisk: RiskLevel;
  readonly requiredApprovers: number;
  readonly description?: string;
};

export interface ApprovalPolicy<TState extends string> {
  route(context: {
    state: TState;
    risk: RiskLevel;
    reason: string;
  }): ApprovalRoute | undefined;
}

/**
 * Deterministic routing based on declared risk. Applications can replace this
 * with policies that also inspect workflow state, amount, tenant, or tags.
 */
export class RiskApprovalPolicy<TState extends string> implements ApprovalPolicy<TState> {
  constructor(private readonly routes: readonly ApprovalRoute[]) {}

  route(context: { state: TState; risk: RiskLevel; reason: string }): ApprovalRoute | undefined {
    return this.routes
      .filter((candidate) => riskRank[candidate.minimumRisk] <= riskRank[context.risk])
      .sort((left, right) => riskRank[right.minimumRisk] - riskRank[left.minimumRisk])[0];
  }
}
