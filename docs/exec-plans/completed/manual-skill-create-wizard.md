# Manual Skill Create Wizard

## Goal

Match the Management Console manual-skill creation sequence with `Name` and
`Edit files` steps, then add an `Availability` step for the Platform Admin
destination scope.

## Scope

- Preserve the existing manual workspace-default payload and fixed BFF route.
- Generate the same starter `SKILL.md` used by Management Console after the
  administrator completes the Name step.
- Edit the raw starter file before destination selection.
- Reuse the existing Agents, Kubernetes, and Virtual machines selector as the
  final step.
- Keep skill files write-only across the Platform Admin boundary.

## Validation

- Add focused regression evidence for all three steps and the final payload.
- Run lint, requirements, contracts, build, and focused UI tests.
- Exercise the complete wizard in a live browser session.

## Outcome

- Added the Management Console step indicator and its `Name` and `Edit files`
  workflow to the Platform Admin create-skill dialog.
- Added `Availability` as step 3, using the existing destination selector.
- Preserved entered file content and destination selections while navigating
  between steps.
- Kept the existing write-only request shape and BFF route unchanged.
