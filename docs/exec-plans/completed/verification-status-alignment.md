# Verification Status Alignment

## Goal

Make the Users directory verification states visually consistent while keeping `Unverified` clearly distinguishable.

## Delivered Scope

- Removed the filled background, padding, and rounded pill treatment from `Unverified`.
- Applied the readable Acorn orange token to the `Unverified` dot and label.
- Added a shared fixed dot-and-label grid to both verification states so every status marker aligns exactly in the table column.
- Removed the superseded unverified-specific color tokens.
- Bumped immutable frontend assets to prototype version 19.
- Preserved verification text as a non-color status signal and left other status treatments unchanged.

## Validation Evidence

- `npm run validate` — passed, including lint, 37 tests, consumer contract checks, harness checks, build, and route smoke tests.
- Live Users directory — confirmed both states render as `inline-grid` with a 7px first column, zero padding, and transparent backgrounds.
- Live alignment measurement — confirmed every visible verification status begins at the same `689.16px` horizontal coordinate.
- Live color inspection — confirmed `Verified` uses `rgb(0, 127, 78)` and `Unverified` uses the readable orange `rgb(172, 65, 24)` for both text and dot.

## Contract Impact

None. This is a presentation-only refinement with no endpoint, payload, filtering, or lifecycle behavior change.
