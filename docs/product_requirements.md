**Version:** 2.1 (Open-Core Production)

**Status:** Architecture Finalized

**Strategy:** Open-Core (Apache 2.0 CLI + Enterprise Cloud SaaS)

## 1. Product Strategy: The Open-Core Edge

TraceBack 2.1 is designed as two distinct but interoperable components:

- **TraceBack Core (OSS):** A MIT/Apache 2.0 licensed CLI that developers can run locally or in their own CI. It uses a "Bring Your Own Key" (BYOK) model for LLM providers.
- **TraceBack Cloud (SaaS):** A managed "Synthetic Teammate" service for enterprises. It provides isolated agent infrastructure, SSO/SCIM identity binding, and **Comprehension Gates** (video/log artifacts for rapid human audit).

## 2. Updated Functional Requirements

### Programmatic Orchestration (@cursor/sdk)

- The system must utilize the **Cursor SDK** to launch headless agent sessions. This allows TraceBack to inherit Cursor's project-wide semantic index (AST-based) without manual context packing.
- **Subagent Multitasking:** Use the `/multitask` protocol to spawn parallel sub-agents to handle different parts of a complex fix (e.g., one for logic, one for tests).

### Evidence-Driven Verification

- **Artifact Generation:** For every fix, the agent must produce a **video demo** and **decision log**. This reduces the "Review Bottleneck" by allowing a human to verify a change in < 120 seconds.
- **Visual Regression:** Use integrated browser tools within the VM to verify frontend fixes visually before opening a PR.

### MCP Tooling & Integration

- **Error Context:** Connect to Sentry via the **Sentry MCP** to pull deep stack traces and breadcrumbs directly into the agent's reasoning loop.
- **External Knowledge:** Utilize the **Playwright MCP** to navigate library documentation or private Wikis to avoid hallucinated API usage.

## 3. Technical Implementation (Resource Optimized)

- **Planner (Maestro):** Claude 4.6 Opus (via Cursor SDK) for high-level blueprinting and dependency analysis.
- **Implementer (Surgeon):** **GPT-5.4 Codex** (using your $100 credits) for surgical backend fixes and refactoring. This model outperforms generalist models by 50% in real-world bug fixing.
- **Verification Sandbox:** **Cursor Cloud Agent VMs** (isolated Ubuntu environments) to run tests and build the project iteratively.