# Open APA Core

Human-governed workflow primitives for agentic operations.

`open-apa-core` helps teams build AI-assisted processes without giving agents unchecked authority. It provides a small TypeScript core for:

- explicit workflow state transitions,
- risk-aware human approvals,
- immutable-style audit events,
- rejection of invalid transitions and overwritten approvals.

## Why

Most agent demos optimize for autonomy. Real operations need traceability, policy boundaries, and a clear handoff to a human when risk is high.

## Install

```bash
npm install @avgon/open-apa-core
```

## Example

```ts
import { GovernedWorkflow } from "@avgon/open-apa-core";

type State = "received" | "review" | "approved" | "rejected";

const payment = new GovernedWorkflow<State>({
  initial: "received",
  transitions: {
    received: ["review"],
    review: ["approved", "rejected"],
    approved: [],
    rejected: [],
  },
});

payment.transition("review", "agent:classifier", "document parsed");
payment.requestApproval({
  id: "iban-change-1",
  requestedBy: "agent:reviewer",
  risk: "high",
  reason: "supplier bank account changed",
});
payment.decideApproval("iban-change-1", "human:controller", "approved");
```

## Roadmap

- Persisted audit adapters
- Policy engine and approval routing
- Workflow templates for finance, procurement, and service operations
- OpenTelemetry integration
- Web dashboard example

## Contributing

Issues, documentation improvements, test cases, workflow templates, and implementation contributions are welcome. Please open an issue before large changes.

## License

Apache-2.0
