# Grey Chevron And Themed Clear Control

## Goal

Keep dropdown arrows visually quiet when open and replace the native workspace-filter clear icon with an AcornOps-themed control.

## Delivered Scope

- Kept select and workspace-combobox chevrons muted grey in closed and open states; rotation remains the state cue.
- Preserved the orange selected-option checkmark and orange focus/open boundary.
- Suppressed the browser-native workspace search cancellation glyph.
- Added an accessible `Clear workspace filter` button with the shared 16px stroke icon, muted default color, warm-neutral hover, and orange focus outline.
- Shows the clear button only when text is present, increases input padding to prevent overlap, and restores the normal padding after clearing.
- Clearing dispatches the existing input event, immediately restores all user results, and leaves workspace suggestions available.
- Bumped immutable prototype assets to version 17.

## Validation Evidence

- `npm run validate` — passed, including lint, 37 tests, consumer contract checks, harness checks, build, and route smoke tests.
- Select chevron — confirmed muted `rgb(123, 107, 97)` in both states with a 180-degree open rotation; selected check remains orange-strong.
- Workspace clear control — confirmed a 34px control with a 16px muted icon, positioned before rather than over the chevron.
- Clear behavior — entered `atlas`, cleared it through the themed action, restored `Showing 6 of 6`, hid the clear action, and reset input padding from 78px to 44px.
- Workspace chevron — confirmed muted open state and 180-degree rotation.
- Compact viewport — confirmed separation between clear and arrow controls, 14px arrow right inset, 78px input padding while populated, and no horizontal overflow at 390px.
