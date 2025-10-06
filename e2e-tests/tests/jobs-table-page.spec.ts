import { test, expect } from '@playwright/test';
import * as utils from '../utils';
import fs from 'fs';


test.describe('Create job tests', () => {
  test.beforeEach(async({ page }) => {
    await page.goto('/', {waitUntil: 'load'});

    const email = utils.getRandomString() + '@email.com';
    const password = 'aaabbb';
    await utils.registerUser(page, email, password);

    await utils.loginUser(page, email, password);
    await page.getByRole('link', {name: 'Jobs'}).click();
  });

  test('should create job with pipeline and input file', async({ page }) => {
    await page.locator('#add-job-button').click();
    await page.getByLabel('pipeline/Autism_annotation').click();

    await page.locator('input[id="file-upload"]').setInputFiles('./fixtures/input-file-1.vcf');

    await page.locator('#create-button').click();
    await expect(page.locator('mat-dialog-container')).not.toBeVisible();
  });

  test('should create job with yml config and input file', async({ page }) => {
    await page.locator('#add-job-button').click();
    await page.getByText('YML text editor').click();

    const config = fs.readFileSync('./fixtures/test-config.yaml').toString();
    await page.locator('#yml-textarea').fill(config);

    await page.locator('input[id="file-upload"]').setInputFiles('./fixtures/input-file-1.vcf');

    await page.locator('#create-button').click();
    await expect(page.locator('mat-dialog-container')).not.toBeVisible();
  });

  test('should check if create button is disabled when no pipeline is selected', async({ page }) => {
    await page.locator('#add-job-button').click();
    await page.locator('input[id="file-upload"]').setInputFiles('./fixtures/input-file-1.vcf');

    await expect(page.locator('#create-button')).toBeDisabled();
    await page.getByLabel('pipeline/Autism_annotation').click();
    await expect(page.locator('#create-button')).toBeEnabled();
  });

  test('should check if create button is disabled when no file is uploaded', async({ page }) => {
    await page.locator('#add-job-button').click();
    await page.getByLabel('pipeline/Autism_annotation').click();

    await expect(page.locator('#create-button')).toBeDisabled();
    await page.locator('input[id="file-upload"]').setInputFiles('./fixtures/input-file-1.vcf');
    await expect(page.locator('#create-button')).toBeEnabled();
  });

  test('should check if create button is disabled when no yml is written', async({ page }) => {
    await page.locator('#add-job-button').click();
    await page.locator('input[id="file-upload"]').setInputFiles('./fixtures/input-file-1.vcf');
    await page.getByText('YML text editor').click();

    await expect(page.locator('#create-button')).toBeDisabled();
    await page.locator('#yml-textarea').fill('mock string');
    await expect(page.locator('#create-button')).toBeEnabled();
  });

  test('should check if create button is disabled when uploaded file is removed', async({ page }) => {
    await page.locator('#add-job-button').click();
    await page.getByLabel('pipeline/Autism_annotation').click();
    await page.locator('input[id="file-upload"]').setInputFiles('./fixtures/input-file-1.vcf');
    await expect(page.locator('#create-button')).toBeEnabled();
    await page.locator('#delete-uploaded-file').click();
    await expect(page.locator('#create-button')).toBeDisabled();
  });

  test('should check if create button is disabled when invalid file is uploaded', async({ page }) => {
    await page.locator('#add-job-button').click();
    await page.getByLabel('pipeline/Autism_annotation').click();
    await page.locator('input[id="file-upload"]').setInputFiles('./fixtures/invalid-input-file.txt');
    await expect(page.locator('#create-button')).toBeDisabled();
    await expect(page.getByText('Unsupported format!')).toBeVisible();
  });
});
