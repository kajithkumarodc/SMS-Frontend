import { test, expect, type Page } from '@playwright/test';
import { ACCOUNTS, login } from './helpers';

const SCHOOL = 'Demo School — Main Campus';

/**
 * Fails the test if the page logs a console error or throws an uncaught exception while
 * `run` executes -- a pre-deployment sanity net independent of whatever the test itself
 * asserts. Ant Design's own React-18-strict-mode warnings and React Query's expected
 * background-refetch noise are not errors, so only `console.error`/`pageerror` count.
 */
/**
 * Chromium auto-logs every non-2xx XHR/fetch response as a console error, independent of
 * whether the app handles it gracefully -- a deliberately-tested 4xx (e.g. "reference not
 * found") is expected/handled here (the page shows a friendly message) and isn't a real bug.
 * 5xx and everything else still fails the check.
 */
function isExpectedNetworkNoise(text: string): boolean {
  return /Failed to load resource: the server responded with a status of 4\d\d/.test(text);
}

async function collectConsoleErrors(page: Page, run: () => Promise<void>): Promise<string[]> {
  const errors: string[] = [];
  const onConsole = (msg: import('@playwright/test').ConsoleMessage) => {
    if (msg.type() === 'error' && !isExpectedNetworkNoise(msg.text())) errors.push(`console.error: ${msg.text()}`);
  };
  const onPageError = (err: Error) => errors.push(`pageerror: ${err.message}`);
  page.on('console', onConsole);
  page.on('pageerror', onPageError);
  try {
    await run();
  } finally {
    page.off('console', onConsole);
    page.off('pageerror', onPageError);
  }
  return errors;
}

test.describe('admissions: no console errors', () => {
  test('public apply page loads clean, through every step, with no console errors', async ({ page }) => {
    const errors = await collectConsoleErrors(page, async () => {
      await page.goto('/admissions/apply');
      await expect(page.getByRole('heading', { name: 'Online Admission Application' })).toBeVisible();

      const schoolSelect = page.getByTestId('admission-school-select');
      await schoolSelect.click();
      const dropdown = page.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden)');
      await expect(dropdown).toBeVisible();
      await dropdown.getByText(SCHOOL, { exact: true }).click();

      await expect(
        page.getByText('Online admissions are currently closed').or(page.getByText(/Applications close/)),
      ).toBeVisible({ timeout: 10_000 });

      // Walk every step (without submitting) so every code path on this page renders.
      if (await page.getByText(/Applications close/).isVisible()) {
        await page.getByTestId('admission-firstname-input').fill('Console');
        await page.getByTestId('admission-lastname-input').fill('Check');
        const dob = page.getByTestId('admission-dob-input');
        await dob.click();
        await dob.fill('2016-05-10');
        await page.keyboard.press('Enter');
        await page.keyboard.press('Escape');
        await page.getByRole('button', { name: 'Next', exact: true }).click();
        await page.getByTestId('admission-guardian-email-input').fill('console.check@example.com');
        await page.getByRole('button', { name: 'Next', exact: true }).click();
        await page.getByRole('button', { name: 'Next', exact: true }).click();
        await expect(page.getByRole('button', { name: 'Submit application' })).toBeVisible();
      }
    });
    expect(errors, `Console errors on /admissions/apply:\n${errors.join('\n')}`).toEqual([]);
  });

  test('public status page loads clean, including a not-found lookup', async ({ page }) => {
    const errors = await collectConsoleErrors(page, async () => {
      await page.goto('/admissions/status');
      await expect(page.getByRole('heading', { name: 'Check your application status' })).toBeVisible();
      await page.getByTestId('admission-status-reference-input').fill('APP-000000');
      await page.getByTestId('admission-status-email-input').fill('nobody@example.com');
      await page.getByRole('button', { name: 'Check status' }).click();
      await expect(page.getByText('Application not found', { exact: false })).toBeVisible();
    });
    expect(errors, `Console errors on /admissions/status:\n${errors.join('\n')}`).toEqual([]);
  });

  test('activate page loads clean with a missing token', async ({ page }) => {
    const errors = await collectConsoleErrors(page, async () => {
      await page.goto('/activate');
      await expect(page.getByText('Missing activation link')).toBeVisible();
    });
    expect(errors, `Console errors on /activate:\n${errors.join('\n')}`).toEqual([]);
  });

  test('admin admissions list + drawer load clean', async ({ page }) => {
    const errors = await collectConsoleErrors(page, async () => {
      await login(page, ACCOUNTS.admin);
      await page.getByRole('menuitem', { name: 'Online Admissions' }).click();
      await expect(page.getByRole('heading', { name: 'Online Admissions', level: 2 })).toBeVisible();

      const firstRef = page.locator('table tbody tr').first().locator('a').first();
      if (await firstRef.count()) {
        await firstRef.click();
        await expect(page.locator('.ant-drawer-content')).toBeVisible();
      }
    });
    expect(errors, `Console errors on /app/admissions:\n${errors.join('\n')}`).toEqual([]);
  });

  test('admin admission cycles page loads clean', async ({ page }) => {
    const errors = await collectConsoleErrors(page, async () => {
      await login(page, ACCOUNTS.admin);
      await page.getByRole('menuitem', { name: 'Admission Cycles' }).click();
      await expect(page.getByRole('heading', { name: 'Admission Cycles', level: 2 })).toBeVisible();
    });
    expect(errors, `Console errors on /app/admission-cycles:\n${errors.join('\n')}`).toEqual([]);
  });
});
