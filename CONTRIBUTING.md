# Contributing to Open APA Core

Thanks for helping build safer, human-governed agentic operations.

## Good contributions

- Reproducible bug reports
- Tests for workflow, approval, or audit edge cases
- Documentation and examples
- Small, focused implementation changes
- Workflow templates that include explicit human approval boundaries

## Before opening a pull request

1. Open or comment on an issue for anything beyond a small documentation or test fix.
2. Keep one user problem per pull request.
3. Run:

```bash
npm run check
npm test
npm run build
```

4. Explain the behavior before and after your change.

## Design principles

- Workflow first, agent second
- Explicit authority boundaries
- High-risk actions require human approval
- Audit events are append-only
- Fail closed when information is missing or confidence is low
