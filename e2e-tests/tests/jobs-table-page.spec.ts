import { test, expect, Page } from '@playwright/test';
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
    await createJobWithPipeline(page, 'pipeline/Autism_annotation', 'input-file-1.vcf');

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
    await createJobWithPipeline(page, 'pipeline/Autism_annotation', 'input-file-1.vcf');

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
    await createJobWithPipeline(page, 'pipeline/Autism_annotation', 'input-file-1.vcf');
    await waitForJobStatus(page, 'success');

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
    const config = fs.readFileSync('./fixtures/test-config.yaml').toString();
    await createJobWithConfig(page, config, 'input-file-1.vcf');

    // wait for create query to finish
    await page.waitForResponse(
      resp => resp.url().includes('/api/jobs/annotate_vcf') && resp.status() === 204
    );

    await waitForJobStatus(page, 'success');

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
    await createJobWithPipeline(page, 'pipeline/GPF-SFARI_annotation', 'input-file-1.vcf');

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
    await createJobWithPipeline(page, 'pipeline/Autism_annotation', 'input-file-1.vcf');

    await page.locator('.first-cell').getByText('info').nth(0).click();
    await page.locator('app-job-details').locator('#delete-button').click();
    await expect(page.locator('app-job-details')).not.toBeVisible();
    await expect(page.locator('.first-cell')).not.toBeVisible();
  });

  test('should check job details modal of failed job', async({ page }) => {
    await page.locator('#add-job-button').click();
    await page.getByLabel('pipeline/Autism_annotation').click();
    await page.locator('input[id="file-upload"]').setInputFiles('./fixtures/input-csv-file.csv');

    await expect(page.locator('app-column-specifying-modal')).toBeVisible();
    await page.locator('[id="CHROM-header"]').locator('mat-select').click();
    await page.getByRole('option', { name: 'chrom', exact: true }).click();

    await page.locator('#create-button').click();
    await waitForJobStatus(page, 'failed');

    await page.locator('.first-cell').getByText('info').nth(0).click();
    await expect(page.locator('app-job-details').locator('.status-label')).toHaveText('failed');
    await expect(page.locator('app-job-details').locator('#download-input')).toBeVisible();
    await expect(page.locator('app-job-details').locator('#download-config')).toBeVisible();
    await expect(page.locator('app-job-details').locator('#download-annotated')).not.toBeVisible();
  });
});

test.describe('Jobs table tests', () => {
  test.beforeEach(async({ page }) => {
    await page.goto('/', {waitUntil: 'load'});

    const email = utils.getRandomString() + '@email.com';
    const password = 'aaabbb';
    await utils.registerUser(page, email, password);

    await utils.loginUser(page, email, password);
    await page.getByRole('link', {name: 'Jobs'}).click();
  });

  test('should create job and check first row', async({ page }) => {
    await createJobWithPipeline(page, 'pipeline/GPF-SFARI_annotation', 'input-file-1.vcf');

    await expect(page.locator('.first-cell').nth(0)).not.toBeEmpty();
    await expect(page.locator('.date').nth(0)).not.toBeEmpty();
    await expect(page.locator('.time').nth(0)).not.toBeEmpty();
    await expect(page.locator('.time-info').nth(1)).not.toBeEmpty();
    await expect(page.locator('.time-info').nth(2)).not.toBeEmpty();
    await expect(page.locator('.delete').nth(0)).not.toBeEmpty();

    await waitForJobStatus(page, 'success');
  });

  test('should check if download button is visible when annotation is success', async({ page }) => {
    await createJobWithPipeline(page, 'pipeline/GPF-SFARI_annotation', 'input-file-1.vcf');

    await waitForJobStatus(page, 'success');

    const downloadPromise = page.waitForEvent('download');
    await page.locator('.download').nth(0).click();
    const downloadedFile = await downloadPromise;

    const fixtureData = scanCSV(await downloadedFile.path(), {truncateRaggedLines: true});
    const downloadData = scanCSV('./fixtures/job-result-1.vcf', {truncateRaggedLines: true});
    const fixtureFrame = await fixtureData.collect();
    const downloadFrame = await downloadData.collect();
    expect(fixtureFrame.toString()).toEqual(downloadFrame.toString());
  });

  test('should check if download button is not visible when job is not finished', async({ page }) => {
    await createJobWithPipeline(page, 'pipeline/GPF-SFARI_annotation', 'input-file-1.vcf');

    await expect(page.locator('.status-label').nth(0)).toBeVisible();
    await expect(page.locator('.download').nth(0)).toBeEmpty();
  });

  test('should create job and then delete it', async({ page }) => {
    await createJobWithPipeline(page, 'pipeline/GPF-SFARI_annotation', 'input-file-1.vcf');

    const lastJobId = await page.locator('.first-cell').evaluate(el => el.textContent);
    await expect(page.getByText(lastJobId)).toBeVisible();

    await page.locator('.delete').nth(0).click();
    await expect(page.getByText(lastJobId)).not.toBeVisible();
  });

  test('should upload tsv file and check specify columns modal content', async({ page }) => {
    await page.locator('#add-job-button').click();
    await page.getByLabel('pipeline/GPF-SFARI_annotation').click();
    await page.locator('input[id="file-upload"]').setInputFiles('./fixtures/input-tsv-file.tsv');

    await expect(page.locator('app-column-specifying-modal')).toBeVisible();
    await page.locator('[id="CHROM-header"]').locator('mat-select').click();
    await page.getByRole('option', { name: 'chrom', exact: true }).click();

    await page.locator('#create-button').click();

    await expect(async() => {
      await expect(page.locator('app-column-specifying-modal')).toBeVisible();
    }).toPass({intervals: [1000, 2000, 3000]});

    await expect(page.locator('#instructions')).toBeVisible();
    await expect(page.locator('#separator')).toBeVisible();

    // row 1 of input file
    await expect(page.locator('.cell').nth(0)).toHaveText('chr1');
    await expect(page.locator('.cell').nth(1)).toHaveText('151405427');
    await expect(page.locator('.cell').nth(2)).toHaveText('T');
    await expect(page.locator('.cell').nth(3)).toHaveText('TCGTCATCA');

    //row 2 of input file
    await expect(page.locator('.cell').nth(4)).toHaveText('chr1');
    await expect(page.locator('.cell').nth(5)).toHaveText('151406013');
    await expect(page.locator('.cell').nth(6)).toHaveText('G');
    await expect(page.locator('.cell').nth(7)).toHaveText('A');
  });

  test('should upload tsv file and specify columns right after creation', async({ page }) => {
    await page.locator('#add-job-button').click();
    await page.getByLabel('pipeline/GPF-SFARI_annotation').click();
    await page.locator('input[id="file-upload"]').setInputFiles('./fixtures/input-tsv-file.tsv');

    await expect(page.locator('app-column-specifying-modal')).toBeVisible();
    await page.locator('[id="CHROM-header"]').locator('mat-select').click();
    await page.getByRole('option', { name: 'chrom', exact: true }).click();

    await page.locator('[id="POS-header"]').locator('mat-select').click();
    await page.getByRole('option', { name: 'pos', exact: true }).click();

    await page.locator('[id="REF-header"]').locator('mat-select').click();
    await page.getByRole('option', { name: 'ref', exact: true }).click();

    await page.locator('[id="ALT-header"]').locator('mat-select').click();
    await page.getByRole('option', { name: 'alt', exact: true }).click();

    await page.locator('#create-button').click();
    await expect(page.locator('.status-label').nth(0)).toContainText('in process');

    await expect(page.locator('.download').nth(0)).toBeEmpty();

    await waitForJobStatus(page, 'success');
  });

  test('should upload csv file and specify columns', async({ page }) => {
    await page.locator('#add-job-button').click();
    await page.getByLabel('pipeline/GPF-SFARI_annotation').click();
    await page.locator('input[id="file-upload"]').setInputFiles('./fixtures/input-csv-file.csv');

    await page.locator('[id="CHROM-header"]').locator('mat-select').click();
    await page.getByRole('option', { name: 'chrom', exact: true }).click();

    await page.locator('[id="POS-header"]').locator('mat-select').click();
    await page.getByRole('option', { name: 'pos', exact: true }).click();

    await page.locator('[id="REF-header"]').locator('mat-select').click();
    await page.getByRole('option', { name: 'ref', exact: true }).click();

    await page.locator('[id="ALT-header"]').locator('mat-select').click();
    await page.getByRole('option', { name: 'alt', exact: true }).click();

    await page.locator('#create-button').click();
    await expect(page.locator('.status-label').nth(0)).toContainText('in process');

    await waitForJobStatus(page, 'success');
  });

  test('should fail job after uploading csv file and make wrong column specification', async({ page }) => {
    await page.locator('#add-job-button').click();
    await page.getByLabel('pipeline/GPF-SFARI_annotation').click();
    await page.locator('input[id="file-upload"]').setInputFiles('./fixtures/input-csv-file.csv');

    await page.locator('[id="CHROM-header"]').locator('mat-select').click();
    await page.getByRole('option', { name: 'ref', exact: true }).click();

    await page.locator('[id="POS-header"]').locator('mat-select').click();
    await page.getByRole('option', { name: 'chrom', exact: true }).click();

    await page.locator('[id="REF-header"]').locator('mat-select').click();
    await page.getByRole('option', { name: 'alt', exact: true }).click();

    await page.locator('[id="ALT-header"]').locator('mat-select').click();
    await page.getByRole('option', { name: 'pos', exact: true }).click();

    await page.locator('#create-button').click();
    await expect(page.locator('.status-label').nth(0)).toContainText('in process');

    await waitForJobStatus(page, 'failed');

    await expect(page.locator('.download').nth(0)).toBeEmpty();
  });

  test('should fail job after uploading csv file and specify only one column', async({ page }) => {
    await page.locator('#add-job-button').click();
    await page.getByLabel('pipeline/GPF-SFARI_annotation').click();
    await page.locator('input[id="file-upload"]').setInputFiles('./fixtures/input-csv-file.csv');

    await expect(page.locator('app-column-specifying-modal')).toBeVisible();
    await page.locator('[id="CHROM-header"]').locator('mat-select').click();
    await page.getByRole('option', { name: 'chrom', exact: true }).click();

    await page.locator('#create-button').click();
    await expect(page.locator('.status-label').nth(0)).toContainText('in process');

    await waitForJobStatus(page, 'failed');

    await expect(page.locator('.download').nth(0)).toBeEmpty();
  });
});

test.describe('Validation tests', () => {
  test.beforeEach(async({ page }) => {
    await page.goto('/', {waitUntil: 'load'});

    const email = utils.getRandomString() + '@email.com';
    const password = 'aaabbb';
    await utils.registerUser(page, email, password);

    await utils.loginUser(page, email, password);
    await page.getByRole('link', {name: 'Jobs'}).click();
  });

  test('should type config without annotators and show error message', async({ page }) => {
    await page.locator('#add-job-button').click();
    await page.getByText('YML text editor').click();

    await page.locator('#yml-textarea').fill('preamble:\n' +
      'input_reference_genome: hg38/genomes/GRCh38-hg38');

    await page.locator('input[id="file-upload"]').setInputFiles('./fixtures/input-file-1.vcf');

    await page.getByText('YML text editor').click(); // trigger config validation

    await expect(page.locator('#create-button')).toBeDisabled();
    await expect(page.getByText('Invalid configuration, reason: \'annotators\'')).toBeVisible();
  });

  test('should type config without peamble and show error message', async({ page }) => {
    await page.locator('#add-job-button').click();
    await page.getByText('YML text editor').click();

    await page.locator('#yml-textarea').fill('annotators:\n' +
      '- allele_score: hg38/scores/CADD_v1.4');

    await page.locator('input[id="file-upload"]').setInputFiles('./fixtures/input-file-1.vcf');

    await page.getByText('YML text editor').click(); // trigger config validation

    await expect(page.locator('#create-button')).toBeDisabled();
    await expect(page.getByText('Invalid configuration, reason: \'preamble\'')).toBeVisible();
  });

  test('should type semantically invalid config and create job', async({ page }) => {
    await page.locator('#add-job-button').click();
    await page.getByText('YML text editor').click();

    await page.locator('#yml-textarea').fill('- A');

    await page.locator('input[id="file-upload"]').setInputFiles('./fixtures/input-file-1.vcf');

    await page.getByText('YML text editor').click(); // trigger config validation

    await page.locator('#create-button').click();

    // wait for create query to finish
    await page.waitForResponse(
      resp => resp.url().includes('/api/jobs/annotate_vcf') && resp.status() === 204
    );

    await waitForJobStatus(page, 'success');
  });

  test('should check if create button is disabled when invalid file is uploaded', async({ page }) => {
    await page.locator('#add-job-button').click();
    await page.getByLabel('pipeline/Autism_annotation').click();
    await page.locator('input[id="file-upload"]').setInputFiles('./fixtures/invalid-input-file-format.yaml');
    await expect(page.getByText('Unsupported format!')).toBeVisible();
    await expect(page.locator('#create-button')).toBeDisabled();
    await expect(page.locator('app-column-specifying-modal')).not.toBeVisible();
    await expect(page.locator('.separator-list')).not.toBeVisible();
  });

  test('should upload invalid vcf file', async({ page }) => {
    await page.locator('#add-job-button').click();
    await page.getByLabel('pipeline/Autism_annotation').click();
    await page.locator('input[id="file-upload"]').setInputFiles('./fixtures/invalid-vcf-input-file.vcf');

    await page.locator('#create-button').click();
    await expect(page.getByText('Invalid VCF file')).toBeVisible();
  });

  // test('should expect error message when daily quota is reached', async({ page }) => {
  //   await page.locator('#add-job-button').click();
  //   await page.getByLabel('pipeline/Autism_annotation').click();
  //   await page.locator('input[id="file-upload"]').setInputFiles('./fixtures/input-file-1.vcf');
  //   await page.locator('#create-button').click();

  //   await waitForJobStatus(page, 'success');

  //   await page.locator('#add-job-button').click();
  //   await page.getByLabel('pipeline/Autism_annotation').click();
  //   await page.locator('input[id="file-upload"]').setInputFiles('./fixtures/input-file-1.vcf');
  //   await page.locator('#create-button').click();

  //   await waitForJobStatus(page, 'success');

  //   await page.locator('#add-job-button').click();
  //   await page.getByLabel('pipeline/Autism_annotation').click();
  //   await page.locator('input[id="file-upload"]').setInputFiles('./fixtures/input-file-1.vcf');
  //   await page.locator('#create-button').click();

  //   await waitForJobStatus(page, 'success');

  //   await page.locator('#add-job-button').click();
  //   await page.getByLabel('pipeline/Autism_annotation').click();
  //   await page.locator('input[id="file-upload"]').setInputFiles('./fixtures/input-file-1.vcf');
  //   await page.locator('#create-button').click();

  //   await waitForJobStatus(page, 'success');

  //   await page.locator('#add-job-button').click();
  //   await page.getByLabel('pipeline/Autism_annotation').click();
  //   await page.locator('input[id="file-upload"]').setInputFiles('./fixtures/input-file-1.vcf');
  //   await page.locator('#create-button').click();

  //   await waitForJobStatus(page, 'success');

  //   await page.locator('#add-job-button').click();
  //   await page.getByLabel('pipeline/Autism_annotation').click();
  //   await page.locator('input[id="file-upload"]').setInputFiles('./fixtures/input-file-1.vcf');
  //   await page.locator('#create-button').click();
  //   await expect(page.getByText('Daily job limit reached!')).toBeVisible();
  // });

  test('should expect error message when file with invalid separator is uploaded', async({ page }) => {
    await page.locator('#add-job-button').click();
    await page.getByLabel('pipeline/Autism_annotation').click();
    await page.locator('input[id="file-upload"]').setInputFiles('./fixtures/invalid-separator.csv');
    await page.locator('#create-button').click();
    await expect(page.getByText('Invalid separator, cannot create proper columns!')).toBeVisible();
  });

  test('should upload file with more than 1000 variants', async({ page }) => {
    await page.locator('#add-job-button').click();
    await page.getByLabel('pipeline/Autism_annotation').click();
    await page.locator('input[id="file-upload"]').setInputFiles('./fixtures/more-than-1000.vcf');
    await page.locator('#create-button').click();
    await expect(page.getByText('Upload limit reached!')).toBeVisible();
  });
});

async function waitForJobStatus(page: Page, status: string): Promise<void> {
  await expect(async() => {
    await page.reload();
    await page.goto('/jobs', {waitUntil: 'load'});
    await expect(page.locator('.status').nth(0)).toHaveText(status, {timeout: 3000});
  }).toPass({intervals: [1000, 2000, 3000]});
}

async function createJobWithPipeline(page: Page, pipeline: string, inputFileName: string): Promise<void> {
  await page.locator('#add-job-button').click();
  await page.getByLabel(pipeline).click();
  await page.locator('input[id="file-upload"]').setInputFiles(`./fixtures/${inputFileName}`);
  await page.locator('#create-button').click();
}

async function createJobWithConfig(page: Page, config: string, inputFileName: string): Promise<void> {
  await page.locator('#add-job-button').click();
  await page.getByText('YML text editor').click();
  await page.locator('#yml-textarea').fill(config);
  await page.locator('input[id="file-upload"]').setInputFiles(`./fixtures/${inputFileName}`);
  await page.locator('#create-button').click();
}

