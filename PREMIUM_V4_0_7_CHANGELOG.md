# DHYEYA V4.0.7 — CBT CSS Rendering Fix

- Fixed a critical frontend regression where the V4.0.5 CBT stylesheet was accidentally emitted outside a `<style>` element.
- The browser was therefore displaying the entire CBT CSS source as visible page text and hiding the usable interface below it.
- Moved the complete CBT stylesheet back inside `<head>` in a dedicated style block.
- Corrected HTML-escaped CSS child selectors (`&gt;` → `>`).
- Bumped frontend cache version to 4.0.7.
- Preserved PostgreSQL, users, tests, questions, server APIs, Dark/Light appearance and CBT logic.
