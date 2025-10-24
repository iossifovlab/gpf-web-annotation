import { test, expect } from '@playwright/test';
import * as utils from '../utils';
import fs from 'fs';
import { scanCSV } from 'nodejs-polars';


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

test.describe('Job details tests', () => {
  test.beforeEach(async({ page }) => {
    await page.goto('/', {waitUntil: 'load'});

    const email = utils.getRandomString() + '@email.com';
    const password = 'aaabbb';
    await utils.registerUser(page, email, password);

    await utils.loginUser(page, email, password);
    await page.getByRole('link', {name: 'Jobs'}).click();
  });

  test('should check job details of the first job', async({ page }) => {
    // create job
    await page.locator('#add-job-button').click();
    await page.getByLabel('pipeline/Autism_annotation').click();
    await page.locator('input[id="file-upload"]').setInputFiles('./fixtures/input-file-1.vcf');
    await page.locator('#create-button').click();

    await page.locator('.first-cell').getByText('info').nth(0).click();
    await expect(page.locator('app-job-details')).toBeVisible();
    await expect(page.locator('app-job-details').locator('.id')).not.toBeEmpty();
    await expect(page.locator('app-job-details').locator('.date')).not.toBeEmpty();
    await expect(page.locator('app-job-details').locator('.time')).not.toBeEmpty();
    await expect(page.locator('app-job-details').locator('.started')).not.toBeEmpty();
    await expect(page.locator('app-job-details').locator('.duration')).not.toBeEmpty();
    await expect(page.locator('app-job-details').locator('.status-label')).not.toBeEmpty();
    await expect(page.locator('app-job-details').locator('#download-input')).toBeVisible();
    await expect(page.locator('app-job-details').locator('#download-config')).toBeVisible();
    await expect(page.locator('app-job-details').locator('#download-annotated')).not.toBeVisible();
    await expect(page.locator('app-job-details').locator('#delete-button')).toBeVisible();
  });

  test('should download uploaded file from job details modal', async({ page }) => {
    // create job
    await page.locator('#add-job-button').click();
    await page.getByLabel('pipeline/Autism_annotation').click();
    await page.locator('input[id="file-upload"]').setInputFiles('./fixtures/input-file-1.vcf');
    await page.locator('#create-button').click();

    await page.locator('.first-cell').getByText('info').nth(0).click();

    const downloadPromise = page.waitForEvent('download');
    await page.locator('app-job-details').locator('#download-input').click();
    const downloadedFile = await downloadPromise;

    const fixtureData = scanCSV(await downloadedFile.path(), {truncateRaggedLines: true});
    const downloadData = scanCSV('./fixtures/input-file-1.vcf', {truncateRaggedLines: true});
    const fixtureFrame = await fixtureData.collect();
    const downloadFrame = await downloadData.collect();
    expect(fixtureFrame.toString()).toEqual(downloadFrame.toString());
  });

  test('should download config file of a job created with annotation pipeline', async({ page }) => {
    // create job
    await page.locator('#add-job-button').click();
    await page.getByLabel('pipeline/Autism_annotation').click();
    await page.locator('input[id="file-upload"]').setInputFiles('./fixtures/input-file-1.vcf');
    await page.locator('#create-button').click();

    // wait for job to finish
    await expect(async() => {
      await page.reload();
      await page.goto('/jobs', {waitUntil: 'load'});
      await expect(page.locator('.status').nth(0)).toHaveText('success');
    }).toPass({intervals: [1000, 2000, 3000]});

    await page.locator('.first-cell').getByText('info').nth(0).click();

    const downloadPromise = page.waitForEvent('download');
    await page.locator('app-job-details').locator('#download-config').click();
    const downloadedFile = await downloadPromise;

    const fixtureData = scanCSV(await downloadedFile.path());
    const downloadData = scanCSV('./fixtures/autism-annotation-pipeline.yaml');
    const fixtureFrame = await fixtureData.collect();
    const downloadFrame = await downloadData.collect();
    expect(fixtureFrame.toString()).toEqual(downloadFrame.toString());
  });

  test('should download config file of a job created with yml config', async({ page }) => {
    // create job
    await page.locator('#add-job-button').click();
    await page.getByText('YML text editor').click();
    const config = fs.readFileSync('./fixtures/test-config.yaml').toString();
    await page.locator('#yml-textarea').fill(config);
    await page.locator('input[id="file-upload"]').setInputFiles('./fixtures/input-file-1.vcf');
    await page.locator('#create-button').click();

    // wait for job to finish
    await expect(async() => {
      await page.reload();
      await page.goto('/jobs', {waitUntil: 'load'});
      await expect(page.locator('.status').nth(0)).toHaveText('success');
    }).toPass({intervals: [1000, 2000, 3000]});

    await page.locator('.first-cell').getByText('info').nth(0).click();

    const downloadPromise = page.waitForEvent('download');
    await page.locator('app-job-details').locator('#download-config').click();
    const downloadedFile = await downloadPromise;

    const fixtureData = scanCSV(await downloadedFile.path());
    const downloadData = scanCSV('./fixtures/test-config.yaml');
    const fixtureFrame = await fixtureData.collect();
    const downloadFrame = await downloadData.collect();
    expect(fixtureFrame.toString()).toEqual(downloadFrame.toString());
  });

  test('should download annotated file from job details modal', async({ page }) => {
    // create job
    await page.locator('#add-job-button').click();
    await page.getByLabel('pipeline/GPF-SFARI_annotation').click();
    await page.locator('input[id="file-upload"]').setInputFiles('./fixtures/input-file-1.vcf');
    await page.locator('#create-button').click();

    await expect(async() => {
      await page.reload();
      await page.goto('/jobs', {waitUntil: 'load'});
      await expect(page.locator('.status').nth(0)).toHaveText('success');
    }).toPass({intervals: [1000, 2000, 3000]});

    await page.locator('.first-cell').getByText('info').nth(0).click();

    const downloadPromise = page.waitForEvent('download');
    await page.locator('app-job-details').locator('#download-annotated').click();
    const downloadedFile = await downloadPromise;

    const fixtureData = scanCSV(await downloadedFile.path(), {truncateRaggedLines: true});
    const downloadData = scanCSV('./fixtures/job-result-1.vcf', {truncateRaggedLines: true});
    const fixtureFrame = await fixtureData.collect();
    const downloadFrame = await downloadData.collect();
    expect(fixtureFrame.toString()).toEqual(downloadFrame.toString());
  });

  test('should delete job from job details modal', async({ page }) => {
    // create job
    await page.locator('#add-job-button').click();
    await page.getByLabel('pipeline/Autism_annotation').click();
    await page.locator('input[id="file-upload"]').setInputFiles('./fixtures/input-file-1.vcf');
    await page.locator('#create-button').click();

    await page.locator('.first-cell').getByText('info').nth(0).click();
    await page.locator('app-job-details').locator('#delete-button').click();
    await expect(page.locator('app-job-details')).not.toBeVisible();
    await expect(page.locator('.first-cell')).not.toBeVisible();
  });
});

