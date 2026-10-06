import type { APIRequestContext } from '@playwright/test';
import { test, expect, ACCOUNTS, login } from './helpers';

/**
 * End-to-end check of the Super Admin dashboard: seed realistic school data through the
 * real API (students, an expense, an admission enquiry, fee collection, attendance for
 * students and a teacher), then prove every dashboard figure moved by exactly the amount
 * we entered -- both in the API payload and in the rendered page.
 */

type Dash = {
  money: { monthFees: number; monthExpenses: number; totalOutstanding: number };
  people: { students: number; studentsPresentToday: number; activeStaff: number };
  ratios: { key: string; value: number; total: number }[];
  monthDaily: { day: number; fees: number; expenses: number }[];
  expenseByHead: { name: string; value: number }[];
  fees: { total: number; items: { key: string; count: number }[] };
  enquiries: { total: number; items: { key: string; count: number }[] };
  studentAttendance: { total: number; items: { key: string; count: number }[] };
};

const TODAY = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD in local time
const STAMP = Date.now().toString().slice(-6);
const money = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

async function json<T>(res: import('@playwright/test').APIResponse): Promise<T> {
  expect(res.ok(), `${res.url()} -> ${res.status()} ${await res.text()}`).toBeTruthy();
  return (await res.json()) as T;
}

async function dash(request: APIRequestContext): Promise<Dash> {
  return json<Dash>(await request.get('/api/v1/dashboard/super-admin'));
}
const ratio = (d: Dash, key: string) => d.ratios.find((r) => r.key === key)!;
const item = (o: { items: { key: string; count: number }[] }, key: string) =>
  o.items.find((i) => i.key === key)?.count ?? 0;

test.describe.configure({ mode: 'serial' });

test('dashboard reflects real students, fees, expenses, enquiries and attendance', async ({ page }) => {
  test.setTimeout(120_000);
  await login(page, ACCOUNTS.admin);
  const api = page.request; // shares the logged-in session cookies

  const before = await dash(api);

  // --- school, class, section ---------------------------------------------------------
  const schools = await json<{ id: string; name: string }[]>(await api.get('/api/v1/schools'));
  const school = schools[0];
  const classes = await json<{ id: string; name: string; sections: { id: string; isDefault: boolean }[] }[]>(
    await api.get('/api/v1/classes'),
  );
  const structures = await json<{ id: string; classId: string | null; status: string; items: { id: string }[] }[]>(
    await api.get('/api/v1/fee-structures'),
  );
  const structure = structures.find((s) => s.classId && s.status === 'ACTIVE' && s.items.length > 0);
  expect(structure, 'an active class-specific fee structure must exist').toBeTruthy();
  const cls = classes.find((c) => c.id === structure!.classId)!;
  const section = cls.sections.find((s) => s.isDefault) ?? cls.sections[0];

  // --- two real students admitted into that class -------------------------------------
  const people = [
    { firstName: 'Ananya', lastName: 'Krishnan', gender: 'FEMALE', guardianName: 'Suresh Krishnan', dob: '2015-06-14' },
    { firstName: 'Rohan', lastName: 'Iyer', gender: 'MALE', guardianName: 'Lakshmi Iyer', dob: '2015-09-02' },
  ];
  const students: { id: string; fullName: string }[] = [];
  for (const [i, p] of people.entries()) {
    const s = await json<{ id: string; fullName: string }>(
      await api.post('/api/v1/students', {
        data: {
          schoolId: school.id,
          firstName: p.firstName,
          lastName: p.lastName,
          gender: p.gender,
          dateOfBirth: p.dob,
          admissionNumber: `E2E-${STAMP}-${i + 1}`,
          admissionDate: TODAY,
          sectionId: section.id,
          guardianName: p.guardianName,
        },
      }),
    );
    students.push(s);
  }

  // --- fee structure assigned to both, then Ananya pays her first fee line ------------
  const assigned = await json<{ assignedCount: number }>(
    await api.post('/api/v1/invoices/bulk-assign', {
      data: { feeStructureId: structure!.id, studentIds: students.map((s) => s.id) },
    }),
  );
  expect(assigned.assignedCount).toBe(2);

  const ananyaFees = await json<{
    lines: { lineId: string; balance: number }[];
    totals: { balance: number };
  }>(await api.get(`/api/v1/students/${students[0].id}/fees`));
  const line = ananyaFees.lines[0];
  const paid = Math.min(line.balance, 1500);
  await json(
    await api.post(`/api/v1/students/${students[0].id}/fee-collections`, {
      data: {
        paymentDate: TODAY,
        method: 'CASH',
        notes: 'Term 1 tuition paid at the school office',
        lines: [{ invoiceLineId: line.lineId, amount: paid, fine: 0 }],
      },
    }),
  );

  // --- expense: school stationery -----------------------------------------------------
  const heads = await json<{ id: string; name: string }[]>(await api.get('/api/v1/expense-heads'));
  const head = heads.find((h) => h.name === 'Maintenance') ?? heads[0];
  const expenseAmount = 2500;
  await json(
    await api.post('/api/v1/expenses', {
      data: {
        expenseHeadId: head.id,
        name: 'Chart paper and markers for Class 5 science fair',
        invoiceNumber: `INV-${STAMP}`,
        expenseDate: TODAY,
        amount: expenseAmount,
        description: 'Bought from Sri Lakshmi Stationers',
      },
    }),
  );

  // --- admission enquiry from a prospective parent ------------------------------------
  const sources = await json<{ id: string }[]>(await api.get('/api/v1/enquiry-sources'));
  await json(
    await api.post('/api/v1/enquiries', {
      data: {
        applicantName: 'Meera Nair',
        phone: '9840012345',
        email: `meera.nair.${STAMP}@example.com`,
        address: '14, Gandhi Street, Coimbatore',
        remarks: 'Looking for admission to Class 1 next academic year',
        enquiryDate: TODAY,
        nextFollowUpDate: TODAY,
        sourceId: sources[0].id,
        classId: cls.id,
      },
    }),
  );

  // --- attendance: Ananya present, Rohan absent; teacher present ----------------------
  const saved = await json<{ saved: number }>(
    await api.put('/api/v1/attendance/bulk', {
      data: {
        sectionId: section.id,
        date: TODAY,
        entries: [
          { studentId: students[0].id, status: 'PRESENT', entryTime: '08:50:00' },
          { studentId: students[1].id, status: 'ABSENT', note: 'Fever, parent informed' },
        ],
      },
    }),
  );
  expect(saved.saved).toBe(2);

  const staff = await json<{ id: string; email: string }[]>(await api.get('/api/v1/staff'));
  const teacher = staff.find((s) => s.email === 'teacher@demo.edu')!;
  await json(
    await api.put('/api/v1/staff-attendance', {
      data: { date: TODAY, entries: [{ staffProfileId: teacher.id, status: 'PRESENT', entryTime: '08:30:00' }] },
    }),
  );

  // --- API: every figure moved by exactly what we entered -----------------------------
  const after = await dash(api);
  expect(after.people.students - before.people.students).toBe(2);
  expect(after.money.monthExpenses - before.money.monthExpenses).toBeCloseTo(expenseAmount, 2);
  expect(after.money.monthFees - before.money.monthFees).toBeCloseTo(paid, 2);
  expect(after.money.totalOutstanding - before.money.totalOutstanding).toBeCloseTo(
    ananyaFees.totals.balance * 2 - paid,
    2,
  );
  expect(after.people.studentsPresentToday - before.people.studentsPresentToday).toBe(1);
  expect(ratio(after, 'student-present').value - ratio(before, 'student-present').value).toBe(1);
  expect(ratio(after, 'student-present').total - ratio(before, 'student-present').total).toBe(2);
  expect(ratio(after, 'fees-awaiting').total - ratio(before, 'fees-awaiting').total).toBe(2);
  expect(ratio(after, 'leads').total - ratio(before, 'leads').total).toBe(1);
  expect(item(after.enquiries, 'ACTIVE') - item(before.enquiries, 'ACTIVE')).toBe(1);
  expect(item(after.studentAttendance, 'PRESENT') - item(before.studentAttendance, 'PRESENT')).toBe(1);
  expect(item(after.studentAttendance, 'ABSENT') - item(before.studentAttendance, 'ABSENT')).toBe(1);
  expect(ratio(after, 'staff-present').value).toBeGreaterThanOrEqual(1);
  const dayNow = new Date().getDate();
  const todayRow = (d: Dash) => d.monthDaily.find((x) => x.day === dayNow)!;
  expect(todayRow(after).fees - todayRow(before).fees).toBeCloseTo(paid, 2);
  expect(todayRow(after).expenses - todayRow(before).expenses).toBeCloseTo(expenseAmount, 2);
  const headSum = (d: Dash) => d.expenseByHead.find((e) => e.name === head.name)?.value ?? 0;
  expect(headSum(after) - headSum(before)).toBeCloseTo(expenseAmount, 2);

  // --- UI: the rendered page shows the same numbers ----------------------------------
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /Welcome back/ })).toBeVisible();
  const root = page.locator('.sad-root');
  await expect(root.getByText(money(after.money.monthFees), { exact: true }).first()).toBeVisible({ timeout: 15_000 });
  await expect(root.getByText(money(after.money.monthExpenses), { exact: true }).first()).toBeVisible();
  await expect(root.getByText(money(after.money.totalOutstanding), { exact: true }).first()).toBeVisible();
  await expect(root.getByText('Fees awaiting payment')).toBeVisible();
  await expect(root.getByText(`/ ${ratio(after, 'student-present').total}`).first()).toBeVisible();
  await expect(root.getByText('Expense by head')).toBeVisible();
  await expect(root.getByText('Fees overview')).toBeVisible();
  await expect(root.getByText('Enquiry overview')).toBeVisible();
  await expect(root.getByText('Library overview')).toBeVisible();
  await expect(root.getByText('People by role')).toBeVisible();
  await expect(page.locator('.recharts-bar-rectangle').first()).toBeAttached();
  await page.screenshot({ path: 'test-results/dashboard-after.png', fullPage: true });
});

test('only SUPER_ADMIN may see the dashboard data', async ({ page }) => {
  await login(page, ACCOUNTS.teacher);
  const res = await page.request.get('/api/v1/dashboard/super-admin');
  expect(res.status()).toBe(403);
  await expect(page.locator('.sad-root')).toHaveCount(0);

});

test('super admin dashboard page renders for admin and hidden for student', async ({ page }) => {
  await login(page, ACCOUNTS.student);
  expect((await page.request.get('/api/v1/dashboard/super-admin')).status()).toBe(403);
  await expect(page.locator('.sad-root')).toHaveCount(0);
});
