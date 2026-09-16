import { describe, expect, it } from "vitest";
import {
  GovernedWorkflow,
  RiskApprovalPolicy,
  type AuditStore,
  type AuditEvent,
} from "../src/index.js";

type State = "received" | "review" | "approved" | "rejected";

const create = () => new GovernedWorkflow<State>({
  initial: "received",
  transitions: {
    received: ["review"],
    review: ["approved", "rejected"],
    approved: [],
    rejected: [],
  },
});

describe("GovernedWorkflow", () => {
  it("records valid transitions in an append-only audit trail", () => {
    const flow = create();
    flow.transition("review", "agent:classifier", "document parsed");
    flow.transition("approved", "human:finance", "verified");

    expect(flow.current()).toBe("approved");
    expect(flow.audit().map((event) => event.type)).toEqual(["created", "transitioned", "transitioned"]);
  });

  it("writes events through an injected audit store", () => {
    const stored: AuditEvent<State>[] = [];
    const store: AuditStore<AuditEvent<State>> = {
      append: (event) => stored.push(event),
      list: () => stored,
    };
    const flow = new GovernedWorkflow<State>({
      initial: "received",
      transitions: { received: ["review"], review: ["approved", "rejected"], approved: [], rejected: [] },
      auditStore: store,
    });

    flow.transition("review", "agent:classifier");
    expect(stored).toHaveLength(2);
    expect(flow.audit()).toEqual(stored);
  });

  it("rejects invalid state transitions", () => {
    const flow = create();
    expect(() => flow.transition("approved", "agent:classifier")).toThrow("not allowed");
  });

  it("routes high-risk approvals through a deterministic policy", () => {
    const flow = new GovernedWorkflow<State>({
      initial: "received",
      transitions: { received: ["review"], review: ["approved", "rejected"], approved: [], rejected: [] },
      approvalPolicy: new RiskApprovalPolicy<State>([
        { id: "manager", minimumRisk: "medium", requiredApprovers: 1 },
        { id: "controller", minimumRisk: "high", requiredApprovers: 2 },
      ]),
    });

    const approval = flow.requestApproval({ id: "approval-1", requestedBy: "agent:reviewer", risk: "high", reason: "bank account changed" });
    expect(approval.route?.id).toBe("controller");
    expect(approval.route?.requiredApprovers).toBe(2);
  });

  it("prevents approval decisions from being overwritten", () => {
    const flow = create();
    flow.requestApproval({ id: "approval-1", requestedBy: "agent:reviewer", risk: "high", reason: "bank account changed" });
    const decided = flow.decideApproval("approval-1", "human:controller", "rejected");

    expect(decided.decision).toBe("rejected");
    expect(() => flow.decideApproval("approval-1", "human:controller", "approved")).toThrow("already decided");
  });

  it("blocks transitions when pending approvals exist and gate is enabled", () => {
    const flow = new GovernedWorkflow<State>({
      initial: "received",
      transitions: { received: ["review"], review: ["approved", "rejected"], approved: [], rejected: [] },
      requireApprovalBeforeTransition: true,
    });

    flow.transition("review", "agent:classifier");
    flow.requestApproval({ id: "a-1", requestedBy: "agent:reviewer", risk: "high", reason: "needs human review" });

    expect(() => flow.transition("approved", "agent:auto")).toThrow("pending approval");
  });

  it("allows transitions once all approvals are decided", () => {
    const flow = new GovernedWorkflow<State>({
      initial: "received",
      transitions: { received: ["review"], review: ["approved", "rejected"], approved: [], rejected: [] },
      requireApprovalBeforeTransition: true,
    });

    flow.transition("review", "agent:classifier");
    flow.requestApproval({ id: "a-1", requestedBy: "agent:reviewer", risk: "high", reason: "needs approval" });
    flow.decideApproval("a-1", "human:manager", "approved");

    flow.transition("approved", "human:manager", "all clear");
    expect(flow.current()).toBe("approved");
  });

  it("does not block transitions when gate is disabled (default)", () => {
    const flow = create();
    flow.transition("review", "agent:classifier");
    flow.requestApproval({ id: "a-1", requestedBy: "agent:reviewer", risk: "medium", reason: "routine" });

    // Default: no gate, transitions allowed even with pending approvals
    flow.transition("approved", "agent:auto");
    expect(flow.current()).toBe("approved");
  });
});
