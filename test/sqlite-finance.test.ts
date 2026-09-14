import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  GovernedWorkflow,
  SqliteAuditStore,
  createFinancePaymentWorkflow,
  paymentRisk,
  type AuditEvent,
} from "../src/index.js";

type State = "received" | "review" | "approved" | "rejected";

describe("SqliteAuditStore", () => {
  it("persists audit events across workflow instances", () => {
    const directory = mkdtempSync(join(tmpdir(), "open-apa-"));
    const path = join(directory, "audit.db");
    const transitions: Record<State, readonly State[]> = {
      received: ["review"],
      review: ["approved", "rejected"],
      approved: [],
      rejected: [],
    };
    const firstStore = new SqliteAuditStore<AuditEvent<State>>(path);
    const first = new GovernedWorkflow<State>({ initial: "received", transitions, auditStore: firstStore });
    first.transition("review", "agent:classifier");
    firstStore.close();

    const secondStore = new SqliteAuditStore<AuditEvent<State>>(path);
    expect(secondStore.list().map((event) => event.type)).toEqual(["created", "transitioned"]);
    secondStore.close();
    rmSync(directory, { recursive: true, force: true });
  });
});

describe("finance payment template", () => {
  it("routes a bank-account change to executive finance", () => {
    const flow = createFinancePaymentWorkflow();
    flow.transition("review", "agent:classifier");
    flow.transition("approval_pending", "agent:reviewer");
    const approval = flow.requestApproval({
      id: "iban-change-1",
      requestedBy: "agent:reviewer",
      risk: paymentRisk({ bankAccountChanged: true }),
      reason: "supplier account changed",
    });

    expect(approval.route?.id).toBe("executive-finance");
    expect(approval.route?.requiredApprovers).toBe(2);
  });

  it("keeps small routine payments low risk", () => {
    expect(paymentRisk({ amount: 2_500, currency: "USD" })).toBe("low");
  });
});
