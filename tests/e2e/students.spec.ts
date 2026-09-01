import { test, expect, type Page } from '@playwright/test';
import { ACCOUNTS, login, selectOption, showAllRows } from './helpers';

const SCHOOL = 'Demo School — Main Campus';

async function openStudents(page: Page): Promise<void> {
  await login(page, ACCOUNTS.admin);
  await page.getByRole('menuitem', { name: 'Students' }).click();
  await expect(page.getByRole('heading', { name: 'Students', level: 2 })).toBeVisible();
  await showAllRows(page);
}

async function addStudent(page: Page, fullName: string, admissionNumber: string): Promise<void> {
  await page.getByRole('button', { name: 'Add student' }).click();
  const dialog = page.getByRole('dialog', { name: 'Add student' });
  await expect(dialog).toBeVisible();
  await selectOption(page, 'student-school-select', SCHOOL);
  await page.getByTestId('student-fullname-input').fill(fullName);
  await page.getByTestId('student-admission-input').fill(admissionNumber);
  await dialog.getByRole('button', { name: 'Add student' }).click();
}

test.describe('students', () => {
  test('admin adds a student and it appears in the list', async ({ page }) => {
    const stamp = Date.now();
    const name = `E2E Added ${stamp}`;
    await openStudents(page);

    await addStudent(page, name, `ADM-E2E-${stamp}`);

    await expect(page.getByRole('dialog', { name: 'Add student' })).toBeHidden();
    await expect(page.getByText(`${name} added`)).toBeVisible();
    await expect(page.getByRole('cell', { name })).toBeVisible();
  });

  test('duplicate admission number shows an inline error and keeps the modal open', async ({ page }) => {
    await openStudents(page);

    // ADM-SMOKE-1 is Priya Sharma's seeded admission number.
    await addStudent(page, `E2E Dup ${Date.now()}`, 'ADM-SMOKE-1');

    const dialog = page.getByRole('dialog', { name: 'Add student' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText('This admission number is already in use')).toBeVisible();
  });

  test('admin edits a student name and the change shows in the list', async ({ page }) => {
    const stamp = Date.now();
    const original = `E2E Edit ${stamp}`;
    const renamed = `E2E Renamed ${stamp}`;
    await openStudents(page);

    await addStudent(page, original, `ADM-EDIT-${stamp}`);
    await expect(page.getByRole('cell', { name: original })).toBeVisible();

    await page
      .getByRole('row', { name: new RegExp(original) })
      .getByRole('button', { name: 'Edit' })
      .click();

    const dialog = page.getByRole('dialog', { name: 'Edit student' });
    await expect(dialog).toBeVisible();
    await page.getByTestId('student-fullname-input').fill(renamed);
    await dialog.getByRole('button', { name: 'Save changes' }).click();

    await expect(dialog).toBeHidden();
    await expect(page.getByRole('cell', { name: renamed })).toBeVisible();
    await expect(page.getByRole('cell', { name: original })).toHaveCount(0);
  });
});
