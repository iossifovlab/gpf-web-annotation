import { test, expect, Page } from '@playwright/test';
import * as utils from './utils';


test.describe('Basic tests', () => {
  test.beforeEach(async({ page }) => {
    await page.goto(utils.frontendUrl, {waitUntil: 'load'});
  });

  test('should check if login page is loaded by default by url', async({ page }) => {
    expect(page.url()).toContain('/login');
  });

   test('should check if user is redirected to login page after trying to access page without being logged in', async({ page }) => {
    page.goto(utils.frontendUrl + '/home', {waitUntil: 'load'});
    expect(page.locator('app-login')).toBeVisible();
    expect(page.url()).toContain('/login');
  });

  test('should check visible elements', async({ page }) => {
    expect(page.locator('#front-page-container')).toBeVisible();
    expect(page.locator('#login-container')).toBeVisible();
    expect(page.locator('#email')).toBeVisible();
    expect(page.locator('#password')).toBeVisible();
    expect(page.locator('#register-link')).toBeVisible();
    expect(page.getByRole('button', { name: 'Login' })).toBeVisible();
    expect(page.locator('#divider')).toBeVisible();
    expect(page.getByRole('button', { name: 'Continue with Google'})).toBeVisible();
  });

  test('should check application description', async({ page }) => {
    expect(page.locator('#front-page-header p')).toHaveText('GPF Web Annotation description');
  });

  test('should check url after navigating to register page', async({ page }) => {
    await page.locator('#register-link').click();
    expect(page.url()).toContain('/register');
  });

  test('should check if user is redirected to register page after clicking the link', async({ page }) => {
    await page.locator('#register-link').click();
    expect(page.locator('app-registration')).toBeVisible();
  });
});
