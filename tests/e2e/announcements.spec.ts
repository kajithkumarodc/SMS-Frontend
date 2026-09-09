import { test, expect } from './helpers';
import type { Page } from '@playwright/test';
import { ACCOUNTS, login } from './helpers';

// Serial suite (workers: 1) — the three tests share this one announcement.
const TITLE = `E2E Announcement ${Date.now()}`;
const BODY = 'Posted by the E2E smoke suite.';

async function openAnnouncements(page: Page): Promise<void> {
  await page.goto('/app/announcements');
  await expect(page.getByRole('heading', { name: 'Announcements', level: 2 })).toBeVisible();
}

function dashboardCard(page: Page) {
  return page.locator('.ant-card', { hasText: 'Announcements' });
}

test.describe.serial('announcements', () => {
  test('admin posts an announcement; it appears in the list and on the admin dashboard', async ({ page }) => {
    await login(page, ACCOUNTS.admin);
    await openAnnouncements(page);

    await page.getByRole('button', { name: 'Post announcement' }).click();
    const dialog = page.getByRole('dialog', { name: 'Post announcement' });
    await expect(dialog).toBeVisible();
    await page.getByTestId('announcement-title-input').fill(TITLE);
    await page.getByTestId('announcement-body-input').fill(BODY);
    await dialog.getByRole('button', { name: 'Post' }).click();
    await expect(dialog).toBeHidden();

    // In the list
    await expect(page.getByText(`Announcement "${TITLE}" posted`)).toBeVisible();
    await expect(page.getByRole('strong').filter({ hasText: TITLE })).toBeVisible();

    // On the admin's own dashboard
    await page.goto('/app/dashboard');
    await expect(dashboardCard(page).getByText(TITLE)).toBeVisible();
  });

  test('the announcement also shows on a teacher dashboard', async ({ page }) => {
    await login(page, ACCOUNTS.teacher); // fresh context
    await expect(page).toHaveURL(/\/app\/dashboard$/);
    await expect(dashboardCard(page).getByText(TITLE)).toBeVisible();
  });

  test('admin deletes the announcement and it is removed', async ({ page }) => {
    await login(page, ACCOUNTS.admin);
    await openAnnouncements(page);

    await expect(page.getByRole('strong').filter({ hasText: TITLE })).toBeVisible();
    await page.locator('div', { hasText: TITLE }).getByRole('button', { name: 'Delete' }).first().click();
    // Confirm in the Popconfirm popover.
    await page
      .locator('.ant-popover:not(.ant-popover-hidden)')
      .getByRole('button', { name: 'Delete' })
      .click();

    await expect(page.getByText('Announcement deleted')).toBeVisible();
    await expect(page.getByRole('strong').filter({ hasText: TITLE })).toHaveCount(0);
  });
});
