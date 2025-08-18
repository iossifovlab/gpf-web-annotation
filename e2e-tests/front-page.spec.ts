import { test, expect } from '@playwright/test';
import * as utils from './utils';


test.describe('Basic tests', () => {
  test.beforeEach(async({ page }) => {
    await page.goto(utils.frontendUrl, {waitUntil: 'load'});
  });

  test('should check if login page is loaded by default', ({ page }) => {
    expect(page.url()).toContain('/login');
  });

  test('should check if user is redirected to login page after ' +
      'trying to access page without being logged in', async({ page }) => {
    await page.goto(utils.frontendUrl + '/home', {waitUntil: 'load'});
    await expect(page.locator('app-login')).toBeVisible();
    expect(page.url()).toContain('/login');
  });

  test('should check visible elements of login page', async({ page }) => {
    await expect(page.locator('#front-page-container')).toBeVisible();
    await expect(page.locator('#login-container')).toBeVisible();
    await expect(page.locator('#email')).toBeVisible();
    await expect(page.locator('#password')).toBeVisible();
    await expect(page.locator('#register-link')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Login' })).toBeVisible();
    await expect(page.locator('#divider')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Continue with Google'})).toBeVisible();
  });

  test('should check application description', async({ page }) => {
    await expect(page.locator('#front-page-header p')).toHaveText('GPF Web Annotation description');
  });

  test('should check url after navigating to register page from login page', async({ page }) => {
    await page.locator('#register-link').click();
    expect(page.url()).toContain('/register');
  });

  test('should check if user is redirected to register page after clicking the link in login page', async({ page }) => {
    await page.locator('#register-link').click();
    await expect(page.locator('app-registration')).toBeVisible();
  });

  test('should check if user is redirected to login page after clicking the link in register page', async({ page }) => {
    await page.goto(utils.frontendUrl + '/register', {waitUntil: 'load'});
    await page.locator('#login-link').click();
    await expect(page.locator('app-login')).toBeVisible();
    expect(page.url()).toContain('/login');
  });
});

test.describe('Registration tests', () => {
  test.beforeEach(async({ page }) => {
    await page.goto(utils.frontendUrl, {waitUntil: 'load'});
    await page.locator('#register-link').click();
  });

  test('should successfully create user', async({ page }) => {
    const randomEmail = `${utils.getRandomString()}@email.com`;
    await page.locator('#email').pressSequentially(randomEmail);
    await page.locator('#password').pressSequentially('password123');
    await page.getByRole('button', { name: 'Create' }).click();
    await expect(page.getByText('Registration successful!')).toBeVisible();
    await expect(page.getByText('Registration successful!')).toHaveCSS('color', 'rgb(0, 128, 0)');
    await expect(page.locator('#email')).toBeEmpty();
    await expect(page.locator('#password')).toBeEmpty();
  });

  test('should not create user with invalid email', async({ page }) => {
    await page.locator('#email').pressSequentially('user');
    await page.locator('#password').pressSequentially('password123');
    await page.getByRole('button', { name: 'Create' }).click();
    await expect(page.getByText('Invalid email format.')).toBeVisible();
    await expect(page.getByText('Invalid email format.')).toHaveCSS('color', 'rgb(255, 0, 0)');
    await expect(page.getByRole('textbox', { name: 'email' })).toHaveValue('user');
    await expect(page.getByRole('textbox', { name: 'email' })).toBeFocused();
    await expect(page.locator('#password')).toHaveValue('password123');
  });

  test('should not create user with invalid password', async({ page }) => {
    await page.locator('#email').pressSequentially('user@email.com');
    await page.locator('#password').pressSequentially('pa');
    await page.getByRole('button', { name: 'Create' }).click();
    await expect(page.getByText('Password must be at least 6 characters long.')).toBeVisible();
    await expect(page.getByText('Password must be at least 6 characters long.')).toHaveCSS('color', 'rgb(255, 0, 0)');
    await expect(page.locator('#email')).toHaveValue('user@email.com');
    await expect(page.locator('#password')).toBeFocused();
    await expect(page.locator('#password')).toHaveValue('pa');
  });

  test('should not create existing user', async({ page }) => {
    const randomEmail = `${utils.getRandomString()}@email.com`;
    await utils.registerUser(page, randomEmail, 'password123');

    await page.locator('#email').pressSequentially(randomEmail);
    await page.locator('#password').pressSequentially('password123');
    await page.getByRole('button', { name: 'Create' }).click();
    await expect(page.getByText('This email is already in use')).toBeVisible();
    await expect(page.getByText('This email is already in use')).toHaveCSS('color', 'rgb(255, 0, 0)');
    await expect(page.locator('#email')).toHaveValue(randomEmail);
    await expect(page.locator('#password')).toHaveValue('password123');
  });

  test('should register and login after that', async({ page }) => {
    const randomEmail = `${utils.getRandomString()}@email.com`;
    await utils.registerUser(page, randomEmail, 'password123');

    await page.locator('#login-link').click();

    await page.locator('#email').pressSequentially('user@email.com');
    await page.locator('#password').pressSequentially('password123');
    await page.getByRole('button', { name: 'Login' }).click();
    await expect(page.locator('app-home')).toBeVisible();
  });
});

test.describe('Login tests', () => {
  test.beforeEach(async({ page }) => {
    await page.goto(utils.frontendUrl, {waitUntil: 'load'});
  });

  test('should check if home page is visible after successful login', async({ page }) => {
    await page.locator('#email').pressSequentially('user@email.com');
    await page.locator('#password').pressSequentially('password123');
    await page.getByRole('button', { name: 'Login' }).click();
    await expect(page.locator('app-home')).toBeVisible();
    await expect(page.locator('#user-data')).toBeVisible();
  });

  test('should check if user is redirected to login page after logout', async({ page }) => {
    const randomEmail = `${utils.getRandomString()}@email.com`;
    await utils.registerUser(page, randomEmail, 'password123');

    await page.locator('#login-link').click();

    await page.locator('#email').pressSequentially(randomEmail);
    await page.locator('#password').pressSequentially('password123');
    await page.getByRole('button', { name: 'Login' }).click();
    await page.waitForSelector('app-home');

    await page.getByRole('button', { name: 'Logout' }).click();
    await expect(page.locator('app-login')).toBeVisible();
  });

  test('should show error message when trying to login with invalid credentials', async({ page }) => {
    await page.locator('#email').pressSequentially('nonexistent@email.com');
    await page.locator('#password').pressSequentially('nonexistentpassword');
    await page.getByRole('button', { name: 'Login' }).click();
    await expect(page.getByText('Invalid login credentials')).toBeVisible();
    await expect(page.locator('app-home')).not.toBeVisible();
  });

  test('should show error message when trying to login without email', async({ page }) => {
    await page.locator('#password').pressSequentially('nonexistentpassword');
    await page.getByRole('button', { name: 'Login' }).click();
    await expect(page.getByText('Invalid login credentials')).toBeVisible();
    await expect(page.locator('app-home')).not.toBeVisible();
  });

  test('should show error message when trying to login without password', async({ page }) => {
    await page.locator('#email').pressSequentially('nonexistent@email.com');
    await page.getByRole('button', { name: 'Login' }).click();
    await expect(page.getByText('Invalid login credentials')).toBeVisible();
    await expect(page.locator('app-home')).not.toBeVisible();
  });
});