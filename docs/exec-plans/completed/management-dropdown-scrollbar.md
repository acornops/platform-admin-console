# Management Dropdown Scrollbar

## Goal

Match the platform dropdown scrollbar to the management console's `custom-scrollbar` treatment.

## Delivered Scope

- Scoped the management scrollbar treatment to platform `.select-menu` overlays.
- Applied a 5px WebKit scrollbar width and height with a transparent track.
- Applied the management 22% Acorn orange thumb, 999px radius, and 40% orange hover state.
- Added Firefox parity with `scrollbar-width: thin` and the equivalent 22% orange/transparent color pair.
- Bumped the immutable stylesheet to prototype version 18.
- Preserved dropdown layout, selection, keyboard, and pointer behavior.

## Validation Evidence

- `npm run validate` — passed, including lint, 37 tests, consumer contract checks, harness checks, build, and route smoke tests.
- Live computed menu — confirmed `overflow-y: auto`, `max-height: 256px`, `scrollbar-width: thin`, and `rgba(255, 112, 59, 0.22)` with a transparent track.
- Live stylesheet inspection — confirmed 5px WebKit dimensions, transparent track, 22% rounded thumb, and 40% hover thumb.
- Live interaction — selected Unverified after the styling change and confirmed the menu closed with the filter applied.
