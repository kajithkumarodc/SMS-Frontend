import { test, expect, ACCOUNTS, login } from './helpers';

/**
 * Drives the real Student Admission form (no API shortcuts) with a realistic student,
 * then proves the Super Admin dashboard's student count rose by exactly one and that the
 * student shows up in Student Details.
 */

const STAMP = Date.now().toString().slice(-6);

async function pickFromSelect(page: import('@playwright/test').Page, id: string, optionText: string | RegExp) {
  await page.locator(`#${id}`).click({ force: true });
  const dropdown = page.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden)').last();
  await expect(dropdown).toBeVisible();
  await dropdown.locator('.ant-select-item-option').filter({ hasText: optionText }).first().click();
}

test('admit a student through the admission form; dashboard count and student list update', async ({ page }) => {
  test.setTimeout(90_000);
  await login(page, ACCOUNTS.admin);
  const studentsBefore = (await (await page.request.get('/api/v1/dashboard/super-admin')).json()).people.students as number;

  await page.goto('/app/student-information/student-admission');
  await expect(page.locator('#admission-admissionNumber')).toBeVisible();

  const first = 'Karthik';
  const last = `Subramanian${STAMP}`;
  await page.locator('#admission-admissionNumber').fill(`UI-${STAMP}`);
  await pickFromSelect(page, 'admission-classId', /^Class 5$/);
  await pickFromSelect(page, 'admission-sectionId', /./);
  await page.locator('#admission-firstName').fill(first);
  await page.locator('#admission-lastName').fill(last);
  await pickFromSelect(page, 'admission-gender', /Male/);
  await page.locator('#admission-dateOfBirth').fill('08/21/2014');
  await page.keyboard.press('Enter');
  await page.locator('#admission-fatherName').fill('Subramanian Venkatesan');
  await page.locator('#admission-fatherPhone').fill('9876543210');
  await page.locator('#admission-motherName').fill('Revathi Subramanian');
  await page.getByRole('radio', { name: 'Father' }).check({ force: true });
  await page.locator('#admission-guardianName').fill('Subramanian Venkatesan');
  await page.locator('#admission-guardianPhone').fill('9876543210');

  await page.getByRole('button', { name: /save/i }).last().click();
  await page.waitForTimeout(2500);
  await expect(page.locator('.ant-form-item-explain-error')).toHaveCount(0);

  // list shows the new student
  await page.goto('/app/student-information/student-details');
  await page.getByPlaceholder(/Search By Student Name/).fill(last);
  await page.getByTestId('student-details-keyword-search').click();
  await expect(page.getByText(`${first} ${last}`).first()).toBeVisible({ timeout: 15_000 });

  // dashboard: +1 student, in both the API and the page
  const after = (await (await page.request.get('/api/v1/dashboard/super-admin')).json()).people.students as number;
  expect(after).toBe(studentsBefore + 1);
  await page.goto('/app/dashboard');
  await expect(page.locator('.sad-hero')).toContainText(`${after}`, { timeout: 15_000 });
});
