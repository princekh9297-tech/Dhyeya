# DHYEYA V4.3.3

This release fixes the broken V4.3.2 admin experience and restores live test loading.

### Deployment
Replace the current Render/GitHub project with this package. Keep the existing environment variables and PostgreSQL database. No database reset is required.

### Important admin workflow
1. Admin Login
2. Admin Control Center
3. Tests & Sections → Create New Test Section
4. PDF Import → select the existing section OR create a new test from the PDF
5. Publish the section
6. Student Platform → Test Series loads published tests directly from PostgreSQL
