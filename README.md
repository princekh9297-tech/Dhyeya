# DHYEYA V3.1.1 — Production

This package includes the V3.1 fixes plus a dedicated public access landing page.

## Public access flow
- `/` → DHYEYA access page when logged out
- Student Login → `/student-login`
- Admin Login → `/admin-login`
- Authenticated users → `/` loads the protected dashboard
- `/index.html` remains authentication protected

## Deployment
Replace the repository contents with this package. Keep the existing PostgreSQL database and environment variables. Do not reset the database.
