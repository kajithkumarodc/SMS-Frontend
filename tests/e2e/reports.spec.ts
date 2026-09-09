import { test, expect } from './helpers';
import { ACCOUNTS, login, selectOption } from './helpers';

test('admin: all three report sections render without errors', async ({ page }) => {
  await login(page, ACCOUNTS.admin);
  // "Reports" can land in the nav's overflow menu at narrow widths, so navigate directly.
  await page.goto('/app/reports');
  await expect(page.getByRole('heading', { name: 'Reports', level: 2 })).toBeVisible();

  // Attendance trend — the line chart mounts for the default last-30-days range.
  const trendCard = page.locator('.ant-card', { hasText: 'Attendance trend' });
  await expect(trendCard.locator('.recharts-line').first()).toBeVisible({ timeout: 15_000 });

  // Academic performance — pick the demo class and the bar chart renders.
  const perfCard = page.locator('.ant-card', { hasText: 'Academic performance' });
  await expect(perfCard.getByText('Pick a class to see its exam averages')).toBeVisible();
  await selectOption(page, 'report-class-select', 'Grade 5');
  await expect(perfCard.locator('.recharts-bar-rectangle').first()).toBeVisible({ timeout: 15_000 });

  // Fee collection — the three stat tiles.
  const feeCard = page.locator('.ant-card', { hasText: 'Fee collection' });
  await expect(feeCard.getByText('Total invoiced')).toBeVisible();
  await expect(feeCard.getByText('Total collected')).toBeVisible();
  await expect(feeCard.getByText('Outstanding')).toBeVisible();

  // No error alert anywhere on the page.
  await expect(page.getByText("Couldn't load", { exact: false })).toHaveCount(0);
});

test('teacher: /app/reports shows the 403 page', async ({ page }) => {
  await login(page, ACCOUNTS.teacher);
  await expect(page.getByTestId('main-nav').getByRole('menuitem', { name: 'Reports' })).toHaveCount(0);

  await page.goto('/app/reports');
  await expect(page.getByText('Not available')).toBeVisible();
  await expect(page.getByText('Only a school administrator can view school-wide reports.')).toBeVisible();
});
