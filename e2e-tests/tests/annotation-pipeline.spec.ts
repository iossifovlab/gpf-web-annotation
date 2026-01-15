import { test, expect } from '@playwright/test';
import * as utils from '../utils';

test.describe('Pipeline tests', () => {
  test.beforeEach(async({ page }) => {
    await page.goto('/', {waitUntil: 'load'});

    const email = utils.getRandomString() + '@email.com';
    const password = 'aaabbb';
    await utils.registerUser(page, email, password);

    await utils.loginUser(page, email, password);
    await page.locator('#annotation-jobs').click();
  });

  test('should create new pipeline and save it', async({ page }) => {
    await page.locator('#pipeline-actions').getByRole('button', { name: 'New' }).click();
    await expect(page.locator('#pipelines-input')).toBeEmpty();
    await expect(page.locator('.monaco-editor').nth(0)).toBeEmpty();

    await utils.clearPipelineEditor(page);
    await utils.typeInPipelineEditor(page, 'preamble:');
    await page.keyboard.press('Enter');
    await utils.typeInPipelineEditor(page, 'input_reference_genome: hg38/genomes/GRCh38-hg38');
    await page.keyboard.press('Enter');
    await page.keyboard.press('Backspace'); // remove auto inserted tabulation
    await utils.typeInPipelineEditor(page, 'annotators:');
    await page.keyboard.press('Enter');
    await page.keyboard.press('Tab');
    await utils.typeInPipelineEditor(page, '- allele_score:');
    await page.keyboard.press('Enter');
    await page.keyboard.press('Tab');
    await utils.typeInPipelineEditor(page, 'resource_id: hg38/scores/CADD_v1.4');

    await page.getByRole('button', { name: 'Save as' }).click();

    await expect(page.locator('#name-modal')).toBeVisible();
    await page.locator('#name-modal input').fill('My Pipeline');
    await page.locator('#name-modal').getByRole('button', { name: 'Save' }).click();

    await expect(page.locator('#pipelines-input')).toHaveValue('My Pipeline');

    // eslint-disable-next-line max-len
    await expect(page.locator('.monaco-editor').nth(0)).toHaveText('preamble:  input_reference_genome: hg38/genomes/GRCh38-hg38annotators:    - allele_score:        resource_id: hg38/scores/CADD_v1.4');
  });

  test('should not be able to save pipeline if invalid', async({ page }) => {
    await page.locator('#pipeline-actions').getByRole('button', { name: 'New' }).click();
    await expect(page.locator('#pipelines-input')).toBeEmpty();
    await expect(page.locator('.monaco-editor').nth(0)).toBeEmpty();

    await utils.clearPipelineEditor(page);
    await utils.typeInPipelineEditor(page, 'preamble:\ninput_reference_genome: hg38/genomes/GRCh38-hg38\n');
    await utils.typeInPipelineEditor(page, 'annotators:\n- allele_score:\n\tresource_id: hg38/scores/CADD_v1.4');

    await expect(page.getByRole('button', { name: 'Save as' })).toBeDisabled();
  });
});


test.describe('Pipeline validation tests', () => {
  test.beforeEach(async({ page }) => {
    await page.goto('/', {waitUntil: 'load'});

    const email = utils.getRandomString() + '@email.com';
    const password = 'aaabbb';
    await utils.registerUser(page, email, password);

    await utils.loginUser(page, email, password);
    await page.locator('#annotation-jobs').click();
  });

  test('should type config without annotators and show error message', async({ page }) => {
    await utils.clearPipelineEditor(page);
    await utils.typeInPipelineEditor(page, 'preamble:\n input_reference_genome: hg38/genomes/GRCh38-hg38');

    await expect(page.getByText('Invalid configuration, reason: \'annotators\'')).toBeVisible();
  });

  test('should type config without peamble and show error message', async({ page }) => {
    await utils.clearPipelineEditor(page);
    await utils.typeInPipelineEditor(page, 'annotators:\n - allele_score: hg38/scores/CADD_v1.4');
    await expect(page.getByText('Invalid configuration, reason: \'preamble\'')).toBeVisible();
  });

  test('should type semantically invalid config and see error', async({ page }) => {
    await utils.clearPipelineEditor(page);
    await utils.typeInPipelineEditor(page, '- allele_score');

    await expect(page.locator('.error-message').nth(0)).toContainText(
      'Invalid configuration, reason: The A0 annotator configuration is incorrect:  ' +
      'The AnnotatorInfo(annotator_id=\'A0\', type=\'allele_score\', attributes=[], ' +
      'parameters={\'work_dir\': PosixPath(\'work\')}, documentation=\'\', resources=[]) ' +
      'has not \'resource_id\' parameters');
  });
});