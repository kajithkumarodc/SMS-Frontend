import { test, expect } from '@playwright/test';
import { ACCOUNTS, DEMO, login, selectOption } from './helpers';

test('teacher marks a student present; the count updates and the mark persists on reload', async ({
  page,
}) => {
  await login(page, ACCOUNTS.teacher);
  await page.getByRole('menuitem', { name: 'Attendance' }).click();
  await expect(page.getByRole('heading', { name: 'Attendance', level: 2 })).toBeVisible();

  await selectOption(page, 'attendance-section-select', DEMO.sectionLabel);

  // Roster loads with the section's one enrolled student.
  await expect(page.getByText(DEMO.studentName)).toBeVisible();

  const segmented = page.getByTestId('roster-segmented');

  // The demo data is shared and re-runnable, so the student may already be
  // marked Present from a previous run. Force a real transition first (AntD's
  // Segmented onChange only fires on an actual value change) so the save and
  // the summary update are observable.
  const selected = segmented.locator('.ant-segmented-item-selected');
  if ((await selected.count()) > 0 && (await selected.innerText()).trim() === 'Present') {
    await segmented.getByText('Absent', { exact: true }).click();
    await expect(page.getByText('Saved')).toBeVisible();
  }

  await segmented.getByText('Present', { exact: true }).click();

  await expect(page.getByText('Saved')).toBeVisible();
  await expect(page.getByTestId('attendance-summary-present')).toContainText('1');

  await page.reload();

  // Section is restored from the URL; the saved mark is reflected in the control.
  const restored = page.getByTestId('roster-segmented');
  await expect(restored.locator('.ant-segmented-item-selected')).toContainText('Present');
  await expect(page.getByTestId('attendance-summary-present')).toContainText('1');
});
