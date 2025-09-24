import { expect, Page } from '@playwright/test';

export function getRandomString(): string {
  return Math.random().toString(36).substring(2, 9);
}

export async function registerUser(page: Page, email: string, password: string): Promise<void> {
  await page.goto('/register', {waitUntil: 'load'});
  await page.locator('#email').pressSequentially(email);
  await page.locator('#password').pressSequentially(password);
  await page.getByRole('button', { name: 'Create' }).click();
  await expect(page.locator('app-login')).toBeVisible();
}

export async function loginUser(page: Page, email: string, password: string): Promise<void> {
  await page.goto('/login', {waitUntil: 'load'});
  await page.locator('#email').pressSequentially(email);
  await page.locator('#password').pressSequentially(password);
  await page.getByRole('button', { name: 'Login' }).click();
  await expect(page.locator('app-home')).toBeVisible();
}