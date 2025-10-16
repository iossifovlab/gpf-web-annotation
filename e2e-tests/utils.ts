import { expect, Page } from '@playwright/test';

export const mailhogUrl = 'http://mail:8025';
// export const mailhogUrl = 'http://localhost:8025';

export function getRandomString(): string {
  return Math.random().toString(36).substring(2, 9);
}

export async function registerUser(page: Page, email: string, password: string): Promise<void> {
  await page.goto('/register', {waitUntil: 'load'});
  await page.locator('#email').pressSequentially(email);
  await page.locator('#password').pressSequentially(password);
  await page.getByRole('button', { name: 'Create' }).click();

  await page.goto(mailhogUrl, {waitUntil: 'load'});
  await expect(async() => {
    await page.getByText(email).click();
  }).toPass({intervals: [1000, 2000, 3000]});
  const href = await page.locator('#preview-plain > a').getAttribute('href');
  if (!href) {
    throw new Error('Confirmation link not found in email.');
  }
  await page.goto(href, {waitUntil: 'load'});

  await expect(page.locator('app-login')).toBeVisible();
}

export async function loginUser(page: Page, email: string, password: string): Promise<void> {
  await page.goto('/login', {waitUntil: 'load'});
  await page.locator('#email').pressSequentially(email);
  await page.locator('#password').pressSequentially(password);
  await page.getByRole('button', { name: 'Login' }).click();
  await expect(page.locator('app-single-annotation')).toBeVisible();
}