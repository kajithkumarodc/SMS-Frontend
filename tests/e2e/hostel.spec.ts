import { test, expect } from './helpers';
import type { Page } from '@playwright/test';
import { ACCOUNTS, DEMO, login, selectOption, showAllRows } from './helpers';

// Serial suite (workers: 1) — test 1 creates the block/room + allocation that test 2 checks.
const STAMP = Date.now();
const BLOCK_NAME = `E2E Block ${STAMP}`;
const ROOM_NUMBER = `E2E-${STAMP}`;
const ROOM_CAPACITY = 2;

async function openHostel(page: Page): Promise<void> {
  await page.goto('/app/hostel'); // "Hostel" can sit in the nav overflow at narrow widths
  await expect(page.getByRole('heading', { name: 'Hostel', level: 2 })).toBeVisible();
}

async function addBlock(page: Page, name: string): Promise<void> {
  await page.getByRole('button', { name: 'Add block' }).click();
  const dialog = page.getByRole('dialog', { name: 'Add block' });
  await expect(dialog).toBeVisible();
  await page.getByTestId('block-name-input').fill(name);
  await dialog.getByRole('button', { name: 'Add block' }).click();
  await expect(dialog).toBeHidden();
}

test.describe.serial('hostel', () => {
  test('admin adds a block + room and allocates a student, whose occupancy and room list update', async ({
    page,
  }) => {
    await login(page, ACCOUNTS.admin);
    await openHostel(page);

    await addBlock(page, BLOCK_NAME);
    await expect(page.getByText(`Block "${BLOCK_NAME}" added`)).toBeVisible();
    await expect(page.getByText(BLOCK_NAME, { exact: true })).toBeVisible();

    // Open the new block and add a room to it.
    await page.locator('.ant-card-hoverable', { hasText: BLOCK_NAME }).click();
    const blockDialog = page.getByRole('dialog', { name: `${BLOCK_NAME} — rooms` });
    await expect(blockDialog).toBeVisible();

    await blockDialog.getByRole('button', { name: 'Add room' }).click();
    const roomDialog = page.getByRole('dialog', { name: 'Add room' });
    await expect(roomDialog).toBeVisible();
    await page.getByTestId('room-number-input').fill(ROOM_NUMBER);
    await page.getByTestId('room-capacity-input').fill(String(ROOM_CAPACITY));
    await roomDialog.getByRole('button', { name: 'Add room' }).click();
    await expect(roomDialog).toBeHidden();

    await expect(page.getByText(`Room ${ROOM_NUMBER} added`)).toBeVisible();
    const roomRow = blockDialog.getByRole('row', { name: new RegExp(ROOM_NUMBER) });
    await expect(roomRow.getByText(`0 / ${ROOM_CAPACITY}`)).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(blockDialog).toBeHidden();

    // Allocate the demo student to the new room, from the Students page.
    await page.goto('/app/students');
    await expect(page.getByRole('heading', { name: 'Students', level: 2 })).toBeVisible();
    await showAllRows(page);

    await page
      .getByRole('row', { name: new RegExp(DEMO.studentName) })
      .getByRole('button', { name: 'Hostel' })
      .click();

    const allocateDialog = page.getByRole('dialog', { name: `${DEMO.studentName} — hostel room` });
    await expect(allocateDialog).toBeVisible();
    await selectOption(page, 'student-hostel-room-select', `${ROOM_NUMBER} (0/${ROOM_CAPACITY})`);
    await allocateDialog.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByText(`${DEMO.studentName} allocated a room`)).toBeVisible();

    // Back on Hostel, occupancy is updated and the room's student list shows the allocation.
    await openHostel(page);
    await page.locator('.ant-card-hoverable', { hasText: BLOCK_NAME }).click();
    const reopenedBlockDialog = page.getByRole('dialog', { name: `${BLOCK_NAME} — rooms` });
    await expect(reopenedBlockDialog).toBeVisible();

    const updatedRoomRow = reopenedBlockDialog.getByRole('row', { name: new RegExp(ROOM_NUMBER) });
    await expect(updatedRoomRow.getByText(`1 / ${ROOM_CAPACITY}`)).toBeVisible();

    await updatedRoomRow.getByRole('button', { name: 'Students' }).click();
    const roomStudentsDialog = page.getByRole('dialog', { name: `Room ${ROOM_NUMBER} — students` });
    await expect(roomStudentsDialog).toBeVisible();
    await expect(roomStudentsDialog.getByText(DEMO.studentName)).toBeVisible();
    await expect(roomStudentsDialog.getByText('Admission ADM-SMOKE-1')).toBeVisible();
  });

  test('student sees the allocation on My Hostel', async ({ page }) => {
    await login(page, ACCOUNTS.student);

    await page.goto('/app/my-hostel'); // "My Hostel" can sit in the nav overflow at narrow widths
    await expect(page).toHaveURL(/\/app\/my-hostel$/);
    await expect(page.getByRole('heading', { name: 'My hostel', level: 2 })).toBeVisible();

    // Allocated by the admin test above (same run) — the room shows, not the empty state.
    await expect(page.getByRole('heading', { name: `Room ${ROOM_NUMBER}`, level: 4 })).toBeVisible();
    await expect(page.getByText(BLOCK_NAME)).toBeVisible();
  });
});
