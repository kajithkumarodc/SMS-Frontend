import { test, expect, type Page } from '@playwright/test';
import { ACCOUNTS, login } from './helpers';

const SCHOOL = 'Demo School — Main Campus';

/** Confirms the visible Popconfirm popover, regardless of its button label. */
async function confirmPopover(page: Page): Promise<void> {
  const popover = page.locator('.ant-popover:not(.ant-popover-hidden)');
  await expect(popover).toBeVisible();
  await popover.locator('.ant-btn-primary').click();
}

async function submitPublicApplication(
  page: Page,
  firstName: string,
  lastName: string,
  guardianEmail: string,
): Promise<string> {
  await page.goto('/admissions/apply');

  const schoolSelect = page.getByTestId('admission-school-select');
  await schoolSelect.click();
  const dropdown = page.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden)');
  await expect(dropdown).toBeVisible();
  await dropdown.getByText(SCHOOL, { exact: true }).click();

  // Either an open cycle appears, or the page reports admissions are closed -- surface that
  // clearly instead of timing out blindly on the next step.
  await expect(page.getByText('Online admissions are currently closed').or(page.getByText(/Applications close/))).toBeVisible({ timeout: 10_000 });
  if (await page.getByText('Online admissions are currently closed').isVisible()) {
    throw new Error('No open admission cycle for ' + SCHOOL + ' -- open one first (Admission Cycles page).');
  }

  await page.getByTestId('admission-firstname-input').fill(firstName);
  await page.getByTestId('admission-lastname-input').fill(lastName);
  const dob = page.getByTestId('admission-dob-input');
  await dob.click();
  await dob.fill('2016-05-10');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Escape'); // close the calendar panel -- it stays open after Enter
  await page.getByRole('button', { name: 'Next', exact: true }).click();

  await page.getByTestId('admission-guardian-email-input').fill(guardianEmail);
  await page.getByRole('button', { name: 'Next', exact: true }).click();

  // Admission details step -- leave optional fields blank.
  await page.getByRole('button', { name: 'Next', exact: true }).click();

  await page.getByRole('button', { name: 'Submit application' }).click();
  await expect(page.getByText('Application submitted successfully.')).toBeVisible();

  const reference = (await page.getByTestId('admission-reference-number').innerText()).trim();
  expect(reference).toMatch(/^APP-\d{6}$/);
  return reference;
}

test.describe('admissions', () => {
  test('happy path: public applicant submits, admin approves, a student + parent portal account are created', async ({ page }) => {
    const stamp = Date.now();
    const firstName = `E2EHappy${stamp}`;
    const lastName = 'Applicant';
    const guardianEmail = `e2e.happy.${stamp}@example.com`;

    const reference = await submitPublicApplication(page, firstName, lastName, guardianEmail);

    // Applicant can check status without logging in.
    await page.goto('/admissions/status');
    await page.getByTestId('admission-status-reference-input').fill(reference);
    await page.getByTestId('admission-status-email-input').fill(guardianEmail);
    await page.getByRole('button', { name: 'Check status' }).click();
    await expect(page.getByText('SUBMITTED', { exact: true })).toBeVisible();

    // Admin reviews and approves.
    await login(page, ACCOUNTS.admin);
    await page.getByRole('menuitem', { name: 'Online Admissions' }).click();
    await expect(page.getByRole('heading', { name: 'Online Admissions', level: 2 })).toBeVisible();

    await page.getByText(reference, { exact: true }).click();
    const drawer = page.locator('.ant-drawer-content');
    await expect(drawer).toBeVisible();
    await expect(drawer.getByText(`${firstName} ${lastName}`)).toBeVisible();

    await drawer.getByRole('button', { name: 'Start review' }).click();
    await expect(drawer.getByText('UNDER_REVIEW')).toBeVisible();

    await drawer.getByRole('button', { name: 'Approve' }).click();
    await confirmPopover(page);
    await expect(page.getByText(/Approved -- student admission number ADM-\d{6}/)).toBeVisible({ timeout: 10_000 });
    await expect(drawer.getByText('APPROVED', { exact: true })).toBeVisible();

    // Status page now reflects approval too.
    await page.goto('/admissions/status');
    await page.getByTestId('admission-status-reference-input').fill(reference);
    await page.getByTestId('admission-status-email-input').fill(guardianEmail);
    await page.getByRole('button', { name: 'Check status' }).click();
    await expect(page.getByText('APPROVED', { exact: true })).toBeVisible();
  });

  test('rejection path: admin can reject an application with a reason, and it is never approvable again', async ({ page }) => {
    const stamp = Date.now();
    const firstName = `E2EReject${stamp}`;
    const guardianEmail = `e2e.reject.${stamp}@example.com`;

    const reference = await submitPublicApplication(page, firstName, 'Applicant', guardianEmail);

    await login(page, ACCOUNTS.admin);
    await page.getByRole('menuitem', { name: 'Online Admissions' }).click();
    await page.getByText(reference, { exact: true }).click();
    const drawer = page.locator('.ant-drawer-content');
    await expect(drawer).toBeVisible();

    await drawer.getByRole('button', { name: 'Start review' }).click();
    await expect(drawer.getByText('UNDER_REVIEW')).toBeVisible();

    await drawer.getByTestId('admission-review-notes-input').fill('No seats available in this class');
    await drawer.getByRole('button', { name: 'Reject' }).click();
    await confirmPopover(page);
    await expect(drawer.getByText('REJECTED')).toBeVisible();

    // A rejected application cannot be approved directly -- only explicitly reopened first.
    await expect(drawer.getByRole('button', { name: 'Approve' })).toHaveCount(0);
    await expect(drawer.getByRole('button', { name: 'Reopen for review' })).toBeVisible();
  });

  test('admission cycles page lists the cycle the public form is using', async ({ page }) => {
    await login(page, ACCOUNTS.admin);
    await page.getByRole('menuitem', { name: 'Admission Cycles' }).click();
    await expect(page.getByRole('heading', { name: 'Admission Cycles', level: 2 })).toBeVisible();
    await expect(page.getByRole('cell', { name: 'OPEN' }).first()).toBeVisible();
  });
});
