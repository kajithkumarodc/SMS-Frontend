import { test, expect, type Page } from '@playwright/test';
import { ACCOUNTS, DEMO, login, selectOption } from './helpers';

async function openGradebook(page: Page): Promise<void> {
  await selectOption(page, 'exams-section-select', DEMO.sectionLabel);
  await page.getByText(DEMO.examName, { exact: true }).first().click();
  // Gradebook renders below with the section roster.
  await expect(page.getByRole('heading', { name: DEMO.examName, level: 4 })).toBeVisible();
  await expect(page.getByText(DEMO.studentName)).toBeVisible();
}

test('teacher enters a mark in the gradebook; it saves and persists on reload', async ({ page }) => {
  await login(page, ACCOUNTS.teacher);
  await page.getByRole('menuitem', { name: 'Exams' }).click();
  await expect(page.getByRole('heading', { name: 'Exams & grading', level: 2 })).toBeVisible();

  await openGradebook(page);

  const input = page.getByTestId('exam-mark-input');
  // Flip to a different value each run so the save is a real change (AntD
  // formats the field as "80.0", so compare numerically).
  const current = Number((await input.inputValue()).trim());
  const mark = current === 80 ? 75 : 80;

  await input.fill(String(mark));
  await input.press('Enter');

  await expect(page.getByText('Saved')).toBeVisible();

  await page.reload();

  // Section is restored from the URL; re-open the gradebook and check the value stuck.
  await openGradebook(page);
  await expect
    .poll(async () => Number((await page.getByTestId('exam-mark-input').inputValue()).trim()))
    .toBe(mark);
});
