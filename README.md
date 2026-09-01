# SMS Frontend

This project is the React + TypeScript frontend for the multi-tenant School Management SaaS.

## Prerequisites

- Node.js 18+
- npm

## Local development

1. Install dependencies:
   ```bash
   npm install
   ```
2. Start the Vite dev server:
   ```bash
   npm run dev
   ```
3. Open the local URL printed in the terminal (usually http://localhost:5173).

## Production build

```bash
npm run build
```

## End-to-end smoke tests (Playwright)

Smoke coverage of the critical happy paths and the security-critical RBAC checks
lives in `tests/e2e/`. These run against the **real running application**, not a
mock, so **both servers must be up first**:

| Server   | Port | How to start | Notes |
|----------|------|--------------|-------|
| Backend  | 8081 | `cd ../SMS-Bankend` then `mvn spring-boot:run "-Dspring-boot.run.arguments=--server.port=8081"` (with `JAVA_HOME` set to a JDK 21+) | Must have the **demo seed data** in the database (demo tenant, `admin@demo.edu` / `teacher@demo.edu` / `student@demo.edu` / `parent@demo.edu`, all password `Passw0rd!`, a "Grade 5 · A" section with one student, and a "Mid-term 2026" exam). |
| Frontend | 5173 | `npm run dev` | |

First-time setup (installs the Chromium browser Playwright drives):

```bash
npx playwright install chromium
```

Run the suite:

```bash
npm run test:e2e        # headless, full suite
npm run test:e2e:ui     # Playwright UI mode, for debugging
```

The tests add / edit a few students and write attendance + exam marks against the
demo tenant — they are designed to be re-runnable, but they do leave test rows
behind in the demo database.
