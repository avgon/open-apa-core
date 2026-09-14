import { InMemoryAuditStore, type AuditStore } from "./audit-store.js";
import type { ApprovalPolicy, ApprovalRoute } from "./policy.js";

export { InMemoryAuditStore, type AuditStore } from "./audit-store.js";
export { SqliteAuditStore, type StoredAuditEvent } from "./sqlite-audit-store.js";
export { RiskApprovalPolicy, type ApprovalPolicy, type ApprovalRoute } from "./policy.js";
export {
  createFinancePaymentWorkflow,
  financeApprovalRoutes,
  financePaymentTransitions,
  paymentRisk,
  type FinancePaymentState,
} from "./templates/finance-payment.js";

export type RiskLevel = "low" | "medium" | "high" | "critical";

export type AuditEvent<TState extends string> = {
  readonly id: string;
  readonly at: string;
  readonly actor: string;
  readonly type: "created" | "transitioned" | "approval_requested" | "approval_decided";
  readonly from?: TState;
  readonly to?: TState;
  readonly detail?: string;
};

export type Approval = {
  readonly id: string;
  readonly requestedBy: string;
  readonly risk: RiskLevel;
  readonly reason: string;
  readonly route?: ApprovalRoute;
  readonly decidedBy?: string;
  readonly decision?: "approved" | "rejected";
};

export class GovernedWorkflow<TState extends string> {
  private state: TState;
  private readonly transitions: ReadonlyMap<TState, readonly TState[]>;
  private readonly auditStore: AuditStore<AuditEvent<TState>>;
  private readonly approvalPolicy?: ApprovalPolicy<TState>;
  private readonly approvals = new Map<string, Approval>();

  constructor(options: {
    initial: TState;
    transitions: Record<TState, readonly TState[]>;
    actor?: string;
    auditStore?: AuditStore<AuditEvent<TState>>;
    approvalPolicy?: ApprovalPolicy<TState>;
  }) {
    this.state = options.initial;
    this.auditStore = options.auditStore ?? new InMemoryAuditStore<AuditEvent<TState>>();
    this.approvalPolicy = options.approvalPolicy;
    this.transitions = new Map(
      Object.entries(options.transitions) as [TState, readonly TState[]][],
    );
    this.record({ actor: options.actor ?? "system", type: "created", to: this.state });
  }

  current(): TState {
    return this.state;
  }

  transition(to: TState, actor: string, detail?: string): void {
    const allowed = this.transitions.get(this.state) ?? [];
    if (!allowed.includes(to)) {
      throw new Error(`Transition ${this.state} -> ${to} is not allowed`);
    }
    const from = this.state;
    this.state = to;
    this.record({ actor, type: "transitioned", from, to, detail });
  }

  requestApproval(input: {
    id: string;
    requestedBy: string;
    risk: RiskLevel;
    reason: string;
  }): Approval {
    if (this.approvals.has(input.id)) throw new Error(`Approval ${input.id} already exists`);
    const route = this.approvalPolicy?.route({
      state: this.state,
      risk: input.risk,
      reason: input.reason,
    });
    const approval: Approval = { ...input, route };
    this.approvals.set(input.id, approval);
    this.record({
      actor: input.requestedBy,
      type: "approval_requested",
      detail: `${input.risk}: ${input.reason}${route ? ` [${route.id}]` : ""}`,
    });
    return approval;
  }

  decideApproval(id: string, decidedBy: string, decision: "approved" | "rejected"): Approval {
    const approval = this.approvals.get(id);
    if (!approval) throw new Error(`Approval ${id} does not exist`);
    if (approval.decision) throw new Error(`Approval ${id} is already decided`);
    const decided: Approval = { ...approval, decidedBy, decision };
    this.approvals.set(id, decided);
    this.record({ actor: decidedBy, type: "approval_decided", detail: `${id}: ${decision}` });
    return decided;
  }

  audit(): readonly AuditEvent<TState>[] {
    return this.auditStore.list();
  }

  approval(id: string): Approval | undefined {
    return this.approvals.get(id);
  }

  private record(event: Omit<AuditEvent<TState>, "id" | "at">): void {
    this.auditStore.append({
      id: crypto.randomUUID(),
      at: new Date().toISOString(),
      ...event,
    });
  }
}
