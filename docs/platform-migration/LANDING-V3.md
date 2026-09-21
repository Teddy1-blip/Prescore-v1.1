# Landing V3 — Financial Signal Flow

Scope: public landing only. The authenticated product, methodology, auth, SMTP,
pricing entitlement rules, infrastructure and schema remain unchanged.

## Audit and direction

KEEP: Inter, deep navy/teal identity, source provenance, Index/readiness/Capacity,
FREE and one-version FULL pricing, legal caveats and existing route guards.
REFINE: hierarchy, copy density, navigation, source explanations, product preview,
focus visibility and intentional phone composition.
REPLACE: copy-left/card-right hero, weak generic trace illustration and paragraph
card grids. The page now moves from an editorial opening through an original
convergence scene to analysis, a synthetic product preview and a 7/30/60 route.

Powens was studied for scale, negative space, depth and product storytelling only.
No competitor copy, page structure, imagery, fonts or animation was imported.

## Implementation

- `app/page.tsx`: thin landing entry.
- `app/components/landing-v3/landing.tsx`: public narrative, source selector,
  preview switches, pricing, native FAQ and mobile navigation.
- `app/components/landing-v3/graphics.tsx`: deterministic SignalFlow SVGs,
  CapacityGraphic and ActionTimeline. Unique SVG IDs via React useId.
- `app/components/landing-v3/landing.css`: scoped tokens and responsive styles.
- `tests/admin-controls.test.mjs`: follows the extracted landing component while preserving cabinet-link assertions.
- `tests/platform-ui.test.mjs`: updated homepage expectation and public-route,
  semantics, synthetic-data and legal-context regression.

No new package dependency, external font, raster illustration, canvas, WebGL,
scroll library or animation framework. Content is server-rendered and remains
readable without motion. Small local React state controls interactions.

## Motion and accessibility

Slow nine-second SVG signal loops explain transport between sources and results.
Source selection highlights related strands. IntersectionObserver changes the
sticky explanation state during ordinary scrolling; it never intercepts scroll.
A pause control stops ambient animation. `prefers-reduced-motion` removes loops,
transitions and sticky positioning; the observer is disconnected. All prose and
results remain present. FAQ uses details/summary. Navigation supports Escape,
ARIA expanded state, keyboard links and visible focus. Artwork is decorative;
source and result meanings are repeated in accessible text.

## Responsive behavior

Desktop: expansive horizontal convergence and editorial headline, sticky analytical
scene, three action columns and a contained product preview.
Tablet: vertical hero flow, compact navigation and removal of the preview sidebar.
Phone: separate vertical SVG, normal-flow analytical story, stacked metrics and
vertical 7/30/60 route. No whole-page overflow masking or transform-scaled UI.

## Validation and release

Run npm ci, npm run build, npm test, npm run lint and npm run validate:artifact.
Record the actual results and staging SHA in the delivery report. The prior
TypeScript reference is baseline 30 / current 15 / new 0; the immediately preceding
test suite contains 5660 tests (three more than the older brief's 5657).

Deploy only via the existing staging GitHub Actions → Git Amvera pipeline. Verify
the new landing on the actual staging origin after delivery. Browser viewport and
internal Amvera log limitations must be disclosed rather than marked as passed.
Human visual approval is required before extending the direction to dashboards.
