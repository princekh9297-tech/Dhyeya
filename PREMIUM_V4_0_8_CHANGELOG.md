# DHYEYA V4.0.8 — Production Stability Release

## Navigation / blank-page fix
- Rebuilt page navigation around one stable `openPage()` path.
- Quick Tools now closes first, then activates the requested page.
- Sidebar navigation uses one delegated handler; duplicate/capture navigation conflicts removed.
- Added render recovery so a navigation exception cannot leave the app with every page hidden.
- Active pages are explicitly visible on mobile/iPad as well as desktop.
- Removed fragile dependence on the topbar page-title nodes.

## Production cleanup
- Topbar simplified to DHYEYA branding plus the existing controls.
- Removed the obsolete Reset Demo Data control from Settings.
- Utility Logout now performs the real server logout and reloads the login state.
- Kept Dark/Light only.
- No database/question-bank changes.

## CBT
- Existing V4.0.7 CBT render fix and premium layout preserved.
- Server-backed test flow preserved.
