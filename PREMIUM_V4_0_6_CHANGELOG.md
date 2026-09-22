# DHYEYA V4.0.6 — Production CBT Hardening

- Removed the obsolete multi-theme engine and theme-world layer. Appearance is now strictly Dark / Light.
- Preserved the compact top-right Dark/Light control beside the profile.
- Fixed a critical server quiz-session lifecycle issue: completed server quizzes no longer get re-created by the 8-second autosave loop after submission.
- Added submission-state guards to prevent autosave/submit race conditions.
- Preserved server-backed test/question loading and PostgreSQL data.
- Hardened CBT answer controls for wrapping, keyboard focus and touch targets.
- Added Escape-key closing for quiz navigator, modals and Quick Tools.
- Added `type="button"` to all buttons that are not form submits, eliminating accidental form submission/navigation.
- Bumped frontend cache version to 4.0.6.
