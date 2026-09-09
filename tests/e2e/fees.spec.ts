import { test, expect } from './helpers';
import type { Page } from '@playwright/test';
import { ACCOUNTS, DEMO, login, selectOption } from './helpers';

// The fee-structure school picker shows the school's display name.
const SCHOOL = 'Demo School — Main Campus';
// A whole-number amount below 1000 avoids thousands-grouping in the formatted label.
const FEE_AMOUNT = 500;
// Serial suite (workers: 1) — test 1 creates the PENDING invoice that test 2 pays.
const FEE_NAME = `E2E Fee ${Date.now()}`;

async function addFeeStructure(page: Page, name: string): Promise<void> {
  await page.getByRole('button', { name: 'Add fee structure' }).click();
  const dialog = page.getByRole('dialog', { name: 'Add fee structure' });
  await expect(dialog).toBeVisible();

  await selectOption(page, 'fee-school-select', SCHOOL);
  await page.getByTestId('fee-name-input').fill(name);
  await page.getByTestId('fee-amount-input').fill(String(FEE_AMOUNT));

  const dueDate = dialog.getByPlaceholder('Select date');
  await dueDate.fill('2026-12-31');
  await dueDate.press('Enter');

  await dialog.getByRole('button', { name: 'Add fee structure' }).click();
  await expect(dialog).toBeHidden();
}

test.describe.serial('fees', () => {
  test('admin adds a fee structure and generates an invoice for a student', async ({ page }) => {
    await login(page, ACCOUNTS.admin);
    await page.goto('/app/fees'); // "Fees" can sit in the nav overflow at narrow widths
    await expect(page.getByRole('heading', { name: 'Fees', level: 2 })).toBeVisible();

    await addFeeStructure(page, FEE_NAME);
    await expect(page.getByText(`Fee structure "${FEE_NAME}" added`)).toBeVisible();
    await expect(page.getByRole('cell', { name: FEE_NAME })).toBeVisible();

    // Generate an invoice for the seeded student against the new structure.
    await selectOption(page, 'invoice-student-select', `${DEMO.studentName} (ADM-SMOKE-1)`);
    await selectOption(page, 'invoice-fee-structure-select', `${FEE_NAME} — ${FEE_AMOUNT}.00`);
    await page.getByRole('button', { name: 'Generate invoice' }).click();
    await expect(page.getByText('Invoice generated — it starts as PENDING')).toBeVisible();
  });

  test('parent sees the PENDING invoice and Pay Now opens Razorpay Checkout', async ({ page }) => {
    await login(page, ACCOUNTS.parent); // fresh context

    await page
      .locator('.ant-card', { hasText: DEMO.studentName })
      .getByRole('link', { name: /Invoices/ })
      .click();
    await expect(page).toHaveURL(/\/app\/children\/[^/]+\/invoices$/);
    await expect(page.getByRole('heading', { name: `${DEMO.studentName} — invoices`, level: 2 })).toBeVisible();

    // A PENDING invoice with its "Pay now" action (the one test 1 generated).
    const pendingRow = page
      .getByRole('row')
      .filter({ has: page.getByRole('button', { name: 'Pay now' }) })
      .first();
    await expect(pendingRow.getByText('Pending')).toBeVisible();
    const payNow = pendingRow.getByRole('button', { name: 'Pay now' });
    await expect(payNow).toBeVisible();

    // Clicking it creates the order and opens Razorpay's hosted Checkout iframe.
    // We stop there — completing a payment means driving a third-party iframe.
    await payNow.click();
    await expect(page.locator('iframe.razorpay-checkout-frame')).toBeAttached({ timeout: 20_000 });
  });
});
