import { test, expect } from '@playwright/test';
import { ACCOUNTS, login } from './helpers';

test.describe('authentication', () => {
  test('admin logs in and lands on the dashboard', async ({ page }) => {
    await login(page, ACCOUNTS.admin);
    await expect(page).toHaveURL(/\/app\/dashboard$/);
    await expect(page.getByRole('heading', { name: /welcome back/i })).toBeVisible();
  });

  test('wrong password shows "Invalid email or password" and stays on /login', async ({ page }) => {
    await page.goto('/login');
    await page.getByTestId('login-email').fill(ACCOUNTS.admin);
    await page.getByTestId('login-password').fill('wrong-password');
    await page.getByRole('button', { name: 'Sign in' }).click();

    await expect(page.getByText('Invalid email or password')).toBeVisible();
    await expect(page).toHaveURL(/\/login$/);
  });

  test('logout returns to /login and protected pages then redirect to /login', async ({ page }) => {
    await login(page, ACCOUNTS.admin);

    await page.getByRole('button', { name: 'Log out' }).click();
    await expect(page).toHaveURL(/\/login$/);

    await page.goto('/app/students');
    await expect(page).toHaveURL(/\/login$/);
  });

  test('visiting a protected page while logged out redirects to /login', async ({ page }) => {
    await page.goto('/app/dashboard');
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible();
  });
});
