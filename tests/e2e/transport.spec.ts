import { test, expect } from './helpers';
import type { Page } from '@playwright/test';
import { ACCOUNTS, DEMO, login, selectOption, showAllRows } from './helpers';

// Serial suite (workers: 1) — test 1 creates the route + assignment that test 2 checks.
const STAMP = Date.now();
const ROUTE_NAME = `E2E Route ${STAMP}`;
const VEHICLE_REG = `E2E-${STAMP}`;

async function openTransport(page: Page): Promise<void> {
  await page.goto('/app/transport'); // "Transport" can sit in the nav overflow at narrow widths
  await expect(page.getByRole('heading', { name: 'Transport', level: 2 })).toBeVisible();
}

async function addRoute(page: Page, name: string): Promise<void> {
  await page.getByRole('button', { name: 'Add route' }).click();
  const dialog = page.getByRole('dialog', { name: 'Add route' });
  await expect(dialog).toBeVisible();
  await page.getByTestId('route-name-input').fill(name);
  await dialog.getByRole('button', { name: 'Add route' }).click();
  await expect(dialog).toBeHidden();
}

async function addVehicle(page: Page, registration: string, routeName: string): Promise<void> {
  await page.getByRole('button', { name: 'Add vehicle' }).click();
  const dialog = page.getByRole('dialog', { name: 'Add vehicle' });
  await expect(dialog).toBeVisible();
  await page.getByTestId('vehicle-registration-input').fill(registration);
  await page.getByTestId('vehicle-driver-input').fill('E2E Driver');
  await page.getByTestId('vehicle-capacity-input').fill('40');
  await selectOption(page, 'vehicle-route-select', routeName);
  await dialog.getByRole('button', { name: 'Add vehicle' }).click();
  await expect(dialog).toBeHidden();
}

test.describe.serial('transport', () => {
  test('admin adds a route + vehicle and assigns a student, who then shows in the route\'s student list', async ({
    page,
  }) => {
    await login(page, ACCOUNTS.admin);
    await openTransport(page);

    await addRoute(page, ROUTE_NAME);
    await expect(page.getByText(`Route "${ROUTE_NAME}" added`)).toBeVisible();
    await expect(page.getByText(ROUTE_NAME, { exact: true })).toBeVisible();

    await addVehicle(page, VEHICLE_REG, ROUTE_NAME);
    await expect(page.getByText(`Vehicle ${VEHICLE_REG} added`)).toBeVisible();

    // Assign the demo student to the new route, from the Students page.
    await page.goto('/app/students');
    await expect(page.getByRole('heading', { name: 'Students', level: 2 })).toBeVisible();
    await showAllRows(page);

    await page
      .getByRole('row', { name: new RegExp(DEMO.studentName) })
      .getByRole('button', { name: 'Transport' })
      .click();

    const assignDialog = page.getByRole('dialog', { name: `${DEMO.studentName} — transport route` });
    await expect(assignDialog).toBeVisible();
    await selectOption(page, 'student-transport-route-select', ROUTE_NAME);
    await assignDialog.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByText(`${DEMO.studentName} assigned to the route`)).toBeVisible();

    // Back on Transport, the route's student list shows the assignment.
    await openTransport(page);
    await page.locator('.ant-card-hoverable', { hasText: ROUTE_NAME }).click();

    const routeDialog = page.getByRole('dialog', { name: `${ROUTE_NAME} — students` });
    await expect(routeDialog).toBeVisible();
    await expect(routeDialog.getByText(DEMO.studentName)).toBeVisible();
    await expect(routeDialog.getByText('Admission ADM-SMOKE-1')).toBeVisible();
  });

  test('student sees the assignment on My Transport', async ({ page }) => {
    await login(page, ACCOUNTS.student);

    await page.goto('/app/my-transport'); // "My Transport" can sit in the nav overflow at narrow widths
    await expect(page).toHaveURL(/\/app\/my-transport$/);
    await expect(page.getByRole('heading', { name: 'My transport', level: 2 })).toBeVisible();

    // Assigned by the admin test above (same run) — the route shows, not the empty state.
    await expect(page.getByRole('heading', { name: ROUTE_NAME, level: 4 })).toBeVisible();
    await expect(page.getByText(VEHICLE_REG)).toBeVisible();
  });
});
