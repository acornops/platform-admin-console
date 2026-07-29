# LLM key settings polish

Status: completed

Coordination slug: `fix/ai-key-settings-polish`

## Goal

Align platform-default LLM key management with the management console's
provider credential rows and Workspace Settings AI icon.

## Requirement classification

- Preserve and refine `REQ-UX-001` through management-console visual parity.
- Preserve and refine `REQ-SET-002` without changing credential behavior.

## Boundaries

- Keep all provider routes, payloads, scopes, roles, and write-only handling
  unchanged.
- Use one stacked provider list with a leading credential icon, provenance
  copy, input, and compact actions.
- Render configured status using the shared semantic green vocabulary.
- Use the exact Lucide Bot geometry used by the management-console AI tab.

## Coordination

The matching management-console change refines copy, provenance badges, and
button sizing. No integration contract or merge-order dependency exists; the
two UI changes may merge independently.

## Validation

- Focused markup, icon, and semantic-status evidence passes.
- The full platform-admin validation entrypoint passes: 98 tests, contract,
  requirements, harness, production-build, and route-smoke checks.
- Desktop and 390 px browser review confirms the stacked provider hierarchy,
  green configured status, exact AI tab icon geometry, and no horizontal
  overflow.
