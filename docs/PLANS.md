# Plans

Active and completed execution plans live in [`docs/exec-plans/active/README.md`](exec-plans/active/README.md) and [`docs/exec-plans/completed/README.md`](exec-plans/completed/README.md). Lasting gaps are tracked in [`docs/exec-plans/tech-debt-tracker.md`](exec-plans/tech-debt-tracker.md).

Completed plans are historical delivery evidence, not a current product specification. Later accepted changes may supersede their UI or behavior descriptions. Future work must start from the [current requirements baseline](product-specs/current-requirements.md) and `DESIGN.md`.

The initial prototype plan is recorded as [completed](exec-plans/completed/platform-admin-console-prototype.md). Current multi-step work is tracked in the active plan until its validation contract passes.

Production identity, human audit attribution, and deployment controls are implemented across `control-plane`, `acornops-deployment`, and this UI/BFF. Remaining work is limited to the explicit blocked governance capabilities in the current requirements.
