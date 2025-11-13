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

  test('should be able to create job with pipeline and input file', async({ page }) => {
    await selectPipeline(page, 'pipeline/Autism_annotation');
    await page.locator('input[id="file-upload"]').setInputFiles('./fixtures/input-file-1.vcf');
    await page.locator('#create-button').click();
  });

  test('should be able to create job with yml config and input file', async({ page }) => {
    await page.getByText('YML text editor').click();

    const config = fs.readFileSync('./fixtures/test-config.yaml').toString();
    await page.locator('#yml-textarea').fill(config);

    await page.getByText('YML text editor').click(); // trigger config validation

    await page.locator('input[id="file-upload"]').setInputFiles('./fixtures/input-file-1.vcf');

    await page.locator('#create-button').click();
  });

  test('should check if create button is disabled when no pipeline is selected', async({ page }) => {
    await page.locator('input[id="file-upload"]').setInputFiles('./fixtures/input-file-1.vcf');

    await expect(page.locator('#create-button')).toBeDisabled();
    await selectPipeline(page, 'pipeline/Autism_annotation');
    await expect(page.locator('#create-button')).toBeEnabled();
  });

  test('should check if create button is disabled when no file is uploaded', async({ page }) => {
    await selectPipeline(page, 'pipeline/Autism_annotation');

    await expect(page.locator('#create-button')).toBeDisabled();
    await page.locator('input[id="file-upload"]').setInputFiles('./fixtures/input-file-1.vcf');
    await expect(page.locator('#create-button')).toBeEnabled();
  });

  test('should check if create button is disabled when no yml is written', async({ page }) => {
    await page.locator('input[id="file-upload"]').setInputFiles('./fixtures/input-file-1.vcf');
    await page.getByText('YML text editor').click();
    await expect(page.locator('#create-button')).toBeDisabled();

    const config = fs.readFileSync('./fixtures/test-config.yaml').toString();
    await page.locator('#yml-textarea').fill(config);
    await page.getByText('YML text editor').click(); // trigger config validation
    await expect(page.locator('#create-button')).toBeEnabled();
  });

  test('should check if create button is disabled when uploaded file is removed', async({ page }) => {
    await selectPipeline(page, 'pipeline/Autism_annotation');
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
    await waitForJobStatus(page, utils.inProcessBackgroundColor);

    await page.locator('.job-id').getByText('info').nth(0).click();
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
    await waitForJobStatus(page, utils.successBackgroundColor);

    await page.locator('.job-id').getByText('info').nth(0).click();

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
    await waitForJobStatus(page, utils.successBackgroundColor);

    await page.locator('.job-id').getByText('info').nth(0).click();

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
      resp => resp.url().includes('/api/jobs/annotate_vcf') && resp.status() === 200
    );

    await waitForJobStatus(page, utils.successBackgroundColor);

    await page.locator('.job-id').getByText('info').nth(0).click();

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
    await createJobWithPipeline(page, 'pipeline/Autism_annotation', 'input-file-1.vcf');
    await waitForJobStatus(page, utils.successBackgroundColor);

    await page.locator('.job-id').getByText('info').nth(0).click();

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
    await waitForJobStatus(page, utils.successBackgroundColor);

    await page.locator('.job-id').getByText('info').nth(0).click();
    await page.locator('app-job-details').locator('#delete-button').click();
    await expect(page.locator('app-job-details')).not.toBeVisible();
    await expect(page.locator('.job-id')).not.toBeVisible();
  });

  test('should check job details modal of failed job', async({ page }) => {
    await selectPipeline(page, 'pipeline/Autism_annotation');
    await page.locator('input[id="file-upload"]').setInputFiles('./fixtures/input-csv-file.csv');

    await expect(page.locator('app-column-specifying')).toBeVisible();
    await page.locator('[id="POS-header"]').locator('mat-select').click();
    await page.getByRole('option', { name: 'vcf_like', exact: true }).click();

    await page.locator('#create-button').click();
    await waitForJobStatus(page, utils.failedBackgroundColor);

    await page.locator('.job-id').getByText('info').nth(0).click();
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
    await waitForJobStatus(page, utils.inProcessBackgroundColor);

    await expect(page.locator('.job-id').nth(0)).not.toBeEmpty();
    await expect(page.locator('.actions').nth(0)).not.toBeEmpty();

    await waitForJobStatus(page, utils.successBackgroundColor);
  });

  test('should check if download button is visible when annotation is success', async({ page }) => {
    await createJobWithPipeline(page, 'pipeline/GPF-SFARI_annotation', 'input-file-1.vcf');
    await waitForJobStatus(page, utils.successBackgroundColor);

    const downloadPromise = page.waitForEvent('download');
    await page.locator('.download-icon').nth(0).click();
    const downloadedFile = await downloadPromise;

    const fixtureData = scanCSV(await downloadedFile.path(), {truncateRaggedLines: true});
    const downloadData = scanCSV('./fixtures/job-result-2.vcf', {truncateRaggedLines: true});
    const fixtureFrame = await fixtureData.collect();
    const downloadFrame = await downloadData.collect();
    expect(fixtureFrame.toString()).toEqual(downloadFrame.toString());
  });

  test('should check if download button is not available when job is not finished', async({ page }) => {
    await createJobWithPipeline(page, 'pipeline/GPF-SFARI_annotation', 'input-file-1.vcf');
    await waitForJobStatus(page, utils.inProcessBackgroundColor);

    await expect(page.locator('.no-download-icon').nth(0)).toBeVisible();
  });

  test('should create job and then delete it', async({ page }) => {
    await createJobWithPipeline(page, 'pipeline/GPF-SFARI_annotation', 'input-file-1.vcf');
    await waitForJobStatus(page, utils.successBackgroundColor);

    const lastJobId = await page.locator('.job-id').evaluate(el => el.textContent);
    await expect(page.getByText(lastJobId)).toBeVisible();

    await page.locator('.delete-icon').nth(0).click();
    await expect(page.getByText(lastJobId)).not.toBeVisible();
  });

  test('should upload tsv file and check specify columns component content', async({ page }) => {
    await selectPipeline(page, 'pipeline/GPF-SFARI_annotation');
    await page.locator('input[id="file-upload"]').setInputFiles('./fixtures/input-tsv-file.tsv');

    await expect(page.locator('app-column-specifying')).toBeVisible();
    await expect(page.locator('[id="CHROM-header"]').locator('mat-select')).toHaveText('chrom');
    await expect(page.locator('[id="POS-header"]').locator('mat-select')).toHaveText('pos');
    await expect(page.locator('[id="REF-header"]').locator('mat-select')).toHaveText('ref');
    await expect(page.locator('[id="ALT-header"]').locator('mat-select')).toHaveText('alt');

    await expect(page.locator('#instructions')).toBeVisible();

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

  test('should upload tsv file and specify columns', async({ page }) => {
    await selectPipeline(page, 'pipeline/GPF-SFARI_annotation');

    await page.locator('input[id="file-upload"]').setInputFiles('./fixtures/input-tsv-file.tsv');

    await expect(page.locator('app-column-specifying')).toBeVisible();

    await page.locator('#create-button').click();
    await page.waitForTimeout(1000);
    await waitForJobStatus(page, utils.inProcessBackgroundColor);

    await expect(page.locator('.no-download-icon').nth(0)).toBeVisible();

    await waitForJobStatus(page, utils.successBackgroundColor);
  });

  test('should upload csv file and specify columns', async({ page }) => {
    await selectPipeline(page, 'pipeline/GPF-SFARI_annotation');
    await page.locator('input[id="file-upload"]').setInputFiles('./fixtures/input-csv-file.csv');
    await page.waitForSelector('#table');

    await page.locator('#create-button').click();
    await waitForJobStatus(page, utils.successBackgroundColor);
  });

  test('should show error message when specifying bad combination of columns', async({ page }) => {
    await selectPipeline(page, 'pipeline/GPF-SFARI_annotation');
    await page.locator('input[id="file-upload"]').setInputFiles('./fixtures/input-csv-file.csv');

    await page.locator('[id="CHROM-header"]').locator('mat-select').click();
    await page.getByRole('option', { name: 'variant', exact: true }).click();

    await expect(page.getByText('Specified set of columns cannot be used together!')).toBeVisible();
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
    await page.getByText('YML text editor').click();

    await page.locator('#yml-textarea').fill('preamble:\n' +
      'input_reference_genome: hg38/genomes/GRCh38-hg38');

    await page.locator('input[id="file-upload"]').setInputFiles('./fixtures/input-file-1.vcf');

    await page.getByText('YML text editor').click(); // trigger config validation

    await expect(page.locator('#create-button')).toBeDisabled();
    await expect(page.getByText('Invalid configuration, reason: \'annotators\'')).toBeVisible();
  });

  test('should type config without peamble and show error message', async({ page }) => {
    await page.getByText('YML text editor').click();

    await page.locator('#yml-textarea').fill('annotators:\n' +
      '- allele_score: hg38/scores/CADD_v1.4');

    await page.locator('input[id="file-upload"]').setInputFiles('./fixtures/input-file-1.vcf');

    await page.getByText('YML text editor').click(); // trigger config validation

    await expect(page.locator('#create-button')).toBeDisabled();
    await expect(page.getByText('Invalid configuration, reason: \'preamble\'')).toBeVisible();
  });

  test('should type semantically invalid config and see error', async({ page }) => {
    await page.getByText('YML text editor').click();

    await page.locator('#yml-textarea').fill('- A');

    await page.locator('input[id="file-upload"]').setInputFiles('./fixtures/input-file-1.vcf');

    await page.getByText('YML text editor').click(); // trigger config validation

    await expect(page.locator('.error-message').nth(0)).toContainText('unsupported annotator type: A');
  });

  test('should check if create button is disabled when invalid file is uploaded', async({ page }) => {
    await selectPipeline(page, 'pipeline/Autism_annotation');

    await page.locator('input[id="file-upload"]').setInputFiles('./fixtures/invalid-input-file-format.yaml');
    await expect(page.getByText('Unsupported format!')).toBeVisible();
    await expect(page.locator('#create-button')).toBeDisabled();
    await expect(page.locator('app-column-specifying')).not.toBeVisible();
    await expect(page.locator('.separator-list')).not.toBeVisible();
  });

  test('should upload invalid vcf file', async({ page }) => {
    await selectPipeline(page, 'pipeline/Autism_annotation');
    await page.locator('input[id="file-upload"]').setInputFiles('./fixtures/invalid-vcf-input-file.vcf');

    await page.locator('#create-button').click();
    await expect(page.getByText('Invalid VCF file')).toBeVisible();
  });

  test('should expect error message file with invalid separator is uploaded', async({ page }) => {
    await selectPipeline(page, 'pipeline/Autism_annotation');
    await page.locator('input[id="file-upload"]').setInputFiles('./fixtures/invalid-separator.csv');
    await page.locator('[id="CHROM+POS+REF+ALT-header"]').locator('mat-select').click();
    await page.getByRole('option', { name: 'chrom', exact: true }).click();
    await expect(page.getByText('Specified set of columns cannot be used together!')).toBeVisible();
    await expect(page.locator('#create-button')).toBeDisabled();
  });

  test('should expect error message if file content is not separeted correctly', async({ page }) => {
    await selectPipeline(page, 'pipeline/Autism_annotation');
    await page.locator('input[id="file-upload"]').setInputFiles('./fixtures/wrongly-separated-row.csv');
    await page.locator('[id="CHROM,POS,REF,ALT-header"]').locator('mat-select').click();
    await page.getByRole('option', { name: 'chrom', exact: true }).click();
    await expect(page.getByText('Specified set of columns cannot be used together!')).toBeVisible();
    await expect(page.locator('#create-button')).toBeDisabled();
  });

  test('should expect error message when no columns are specified', async({ page }) => {
    await selectPipeline(page, 'pipeline/Autism_annotation');
    await page.locator('input[id="file-upload"]').setInputFiles('./fixtures/wrongly-separated-row.csv');

    await page.locator('#create-button').click();
    await expect(page.getByText('Invalid column specification!')).toBeVisible();
  });

  test('should upload file with more than 1000 variants', async({ page }) => {
    await selectPipeline(page, 'pipeline/Autism_annotation');
    await page.locator('input[id="file-upload"]').setInputFiles('./fixtures/more-than-1000.vcf');
    await page.locator('#create-button').click();
    await expect(page.getByText('Upload limit reached!')).toBeVisible();
  });
});

async function selectPipeline(page: Page, pipeline: string): Promise<void> {
  await page.locator('#pipelines-input').click();
  await page.getByRole('option', { name: pipeline, exact: true }).click();
}

async function waitForJobStatus(page: Page, color: string): Promise<void> {
  await expect(async() => {
    await page.reload();
    await page.goto('/jobs', {waitUntil: 'load'});
    await expect(page.locator('.grid-cell').nth(0)).toHaveCSS('background-color', color);
  }).toPass({intervals: [1000, 2000, 3000]});
}

async function createJobWithPipeline(page: Page, pipeline: string, inputFileName: string): Promise<void> {
  await selectPipeline(page, pipeline);
  await page.locator('input[id="file-upload"]').setInputFiles(`./fixtures/${inputFileName}`);
  await page.locator('#create-button').click();
}

async function createJobWithConfig(page: Page, config: string, inputFileName: string): Promise<void> {
  await page.getByText('YML text editor').click();
  await page.locator('#yml-textarea').fill(config);
  await page.getByText('YML text editor').click(); // trigger config validation
  await page.locator('input[id="file-upload"]').setInputFiles(`./fixtures/${inputFileName}`);
  await page.locator('#create-button').click();
}

