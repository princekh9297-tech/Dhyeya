# DHYEYA V4.0.2 — Visual World + Premium Quiz Stability Fix

This patch keeps the V4.0.1 data/backend architecture intact and fixes the visual regressions reported after deployment.

## Fixed
- Theme Studio is now a true fixed viewport modal with a very high z-index; it cannot render underneath the Tests/PYQ content.
- Theme cards have a stronger visual preview, active state, hover state and responsive layout.
- Each theme now changes the whole application environment: page background, navigation shell, cards, test shell, options, selected states and visual atmosphere.
- FIRE, ICE, SPACE, GAME, STUDY and ARGHYA receive distinct high-contrast visual treatments.
- Question text and option text have explicit readable contrast in every theme.
- Quiz layout was rebuilt with a premium question surface, stronger hierarchy, larger option cards, improved navigator and cleaner controls.
- Mobile quiz navigator remains an overlay/drawer and no longer collides with the main quiz content.
- Timer warning/critical treatment is more visible.
- Theme modal and quiz overlay z-index layers are separated to prevent stacking collisions.
- Cache-busting version updated to 4.0.2 for frontend assets.

## Preserved
- PostgreSQL database and all existing data.
- 25,000+ question architecture.
- BPSC subject-wise PYQ archive.
- Admin question import/edit/delete/bulk delete.
- A–E answers and NULL/* answer handling.
- Existing Practice/Exam server integration.
- Existing planner, revision, performance and authentication functionality.
