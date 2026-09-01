import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end smoke tests. These run against the REAL running application:
 *  - frontend dev server on http://localhost:5173  (`npm run dev`)
 *  - backend on http://localhost:8081 with the demo seed data already in the DB
 *
 * Both servers must be up before running the suite — see README.md. The config
 * deliberately does not start either server so the two concerns stay separate
 * (the backend needs a JDK + Postgres and is owned by the SMS-Bankend module).
 */
export default defineConfig({
  testDir: './tests/e2e',
  // The smoke tests mutate shared demo data (add/edit students, mark attendance,
  // enter marks), so they run serially against one worker to stay deterministic.
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  timeout: 30_000,
  expect: { timeout: 10_000 },
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    actionTimeout: 10_000,
    navigationTimeout: 15_000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
