# Platform Admin Visual Identity

Status: completed

## Outcome

The platform admin console is immediately distinguishable from the management console while preserving its application structure, typography, spacing, and component vocabulary.

## Delivered

- Added a restrained, accessible cream-clay tint that remains slightly perceptible in the sidebar and responsive header, with stronger clay reserved for selection and identity cues.
- Kept primary and activation controls aligned with the management console's dark neutral and Acorn-orange treatments.
- Added persistent shield-labelled `Platform Admin` identity cues to the desktop sidebar and responsive header.
- Added a shield favicon, explicit `Platform Admin Console · AcornOps` browser title, and `data-console="platform-admin"` document marker.
- Preserved green, warning, and danger semantics from the management console.
- Kept the confidentiality boundary visible and paired every color cue with text, iconography, or document metadata.
- Documented the visual contract in `DESIGN.md` and `docs/DESIGN.md`.
- Extended UI alignment tests with visual-identity and calculated WCAG contrast checks.

## Validation Evidence

- `npm run validate:ci`
  - 20 tests passed.
  - Coverage: 85.06% lines, 70.12% branches, 85.71% functions.
  - Contract checks passed for 14 routes, 8 scopes, DTO fields, and privacy projections.
  - Harness checks passed for 32 required files.
  - Build and static/API/denial smoke routes passed.
- Live browser verification at `http://127.0.0.1:4173/`
  - Responsive console identity rendered correctly.
  - No browser runtime errors were reported.

## Contract Impact

None. This change is visual and documentation-only; it does not add or alter API routes, authorization scopes, request/response fields, or confidentiality boundaries.
