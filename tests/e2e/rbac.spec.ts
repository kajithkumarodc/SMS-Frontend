import { test, expect } from '@playwright/test';
import { ACCOUNTS, DEMO, login, navLabels } from './helpers';

test.describe('role-based access control', () => {
  test('TEACHER: no "Add student" button, and /app/classes is forbidden', async ({ page }) => {
    await login(page, ACCOUNTS.teacher);

    await page.getByRole('menuitem', { name: 'Students' }).click();
    await expect(page).toHaveURL(/\/app\/students$/);
    await expect(page.getByRole('heading', { name: 'Students', level: 2 })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Add student' })).toHaveCount(0);

    await page.goto('/app/classes');
    await expect(page.getByText('Not available')).toBeVisible();
    await expect(
      page.getByText('Only a school administrator can manage classes, sections and subjects.'),
    ).toBeVisible();
  });

  test('STUDENT: nav is limited to Dashboard, My Attendance, My Results', async ({ page }) => {
    await login(page, ACCOUNTS.student);

    expect(await navLabels(page)).toEqual(['Dashboard', 'My Attendance', 'My Results']);

    // Students is neither in the nav nor reachable by menu.
    await expect(page.getByRole('menuitem', { name: 'Students' })).toHaveCount(0);
    await expect(page.getByRole('menuitem', { name: 'Classes' })).toHaveCount(0);
    await expect(page.getByRole('menuitem', { name: 'Exams' })).toHaveCount(0);
  });

  test('PARENT: dashboard lists both children; a non-child results URL says not found', async ({ page }) => {
    await login(page, ACCOUNTS.parent);

    await expect(page.getByRole('heading', { name: 'My children' })).toBeVisible();
    for (const child of DEMO.children) {
      await expect(page.getByRole('heading', { name: child, exact: true })).toBeVisible();
    }

    // A student id that is not this parent's child -> backend 404 -> friendly screen.
    await page.goto('/app/children/00000000-0000-0000-0000-000000000000/results');
    await expect(page.getByText('Student not found')).toBeVisible();
    await expect(page.getByText("This student isn't linked to your account.")).toBeVisible();
  });
});
