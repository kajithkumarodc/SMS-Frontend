import { test as base, expect, type Page } from '@playwright/test';

/**
 * Shared fixture: disable CSS transitions/animations so Ant Design's dropdown,
 * modal and segmented-control motion doesn't make elements "unstable" for
 * Playwright's actionability checks. This is the recommended way to keep
 * animation-heavy UIs deterministic without arbitrary waits.
 */
export const test = base.extend({
  page: async ({ page }, use) => {
    await page.addInitScript(() => {
      const css =
        '*,*::before,*::after{animation-duration:0s!important;animation-delay:0s!important;' +
        'transition-duration:0s!important;transition-delay:0s!important}';
      const style = document.createElement('style');
      style.appendChild(document.createTextNode(css));
      (document.head ?? document.documentElement).appendChild(style);
    });
    await use(page);
  },
});

export { expect };

/** Demo seed accounts (all share the same password). See README.md / the SMS-Bankend seed. */
export const DEMO_PASSWORD = 'Passw0rd!';
export const ACCOUNTS = {
  admin: 'admin@demo.edu',
  teacher: 'teacher@demo.edu',
  student: 'student@demo.edu',
  parent: 'parent@demo.edu',
} as const;

/** The demo tenant's one section ("Grade 5 · A") and its single enrolled student. */
export const DEMO = {
  sectionLabel: 'Grade 5 · A',
  studentName: 'Priya Sharma',
  examName: 'Mid-term 2026',
  children: ['Ajith', 'Priya Sharma'],
} as const;

/**
 * Log in through the real login form and wait for the dashboard. The school code
 * field is pre-filled from VITE_DEFAULT_SCHOOL_IDENTIFIER=demo, so only the
 * email + password are entered here.
 */
export async function login(
  page: Page,
  email: string,
  password: string = DEMO_PASSWORD,
): Promise<void> {
  await page.goto('/login');
  await page.getByTestId('login-email').fill(email);
  await page.getByTestId('login-password').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/app\/dashboard$/);
}

/**
 * Pick an option in a searchable AntD `<Select>` (identified by its data-testid).
 * Opens the dropdown, then clicks the matching row inside the currently-open
 * panel. rc-select's virtualised list keeps an off-screen `role="option"` mirror
 * per value, so we target the visible `.ant-select-item-option` row directly
 * rather than the ambiguous ARIA role.
 */
export async function selectOption(page: Page, testId: string, optionLabel: string): Promise<void> {
  const select = page.getByTestId(testId);
  await select.click();
  const dropdown = page.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden)');
  await expect(dropdown).toBeVisible();
  const option = dropdown
    .locator('.ant-select-item-option')
    .filter({ has: page.getByText(optionLabel, { exact: true }) });
  await option.first().click();
  await expect(dropdown).toBeHidden();
  await expect(select.locator('.ant-select-selection-item')).toHaveText(optionLabel);
}

/**
 * Bump an AntD Table's page size to its max so a freshly-created row is on the
 * visible page regardless of natural row order (the students list has no sort).
 */
export async function showAllRows(page: Page): Promise<void> {
  const sizer = page.locator('.ant-pagination-options .ant-select-selector');
  if ((await sizer.count()) === 0) return;
  await sizer.click();
  await page.getByRole('option', { name: '100 / page' }).click();
}

/** The visible labels of the top navigation menu items, in order. */
export async function navLabels(page: Page): Promise<string[]> {
  const items = page.getByTestId('main-nav').getByRole('menuitem');
  await expect(items.first()).toBeVisible();
  return (await items.allInnerTexts()).map((t) => t.trim()).filter(Boolean);
}
