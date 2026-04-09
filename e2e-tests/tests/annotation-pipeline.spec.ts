import { test, expect, Page } from '@playwright/test';
import * as utils from '../utils';

test.describe('Pipeline tests', () => {
  test.beforeEach(async({ page }) => {
    await page.goto('/', {waitUntil: 'load'});

    const email = utils.getRandomString() + '@email.com';
    const password = 'aaabbb';
    await utils.registerUser(page, email, password);

    await utils.loginUser(page, email, password);
    // wait for default pipeline to load
    await page.waitForSelector('.loaded-editor', { state: 'visible', timeout: 120000 });
  });

  test('should create new pipeline and save it', async({ page }) => {
    await page.locator('#pipeline-actions').getByRole('button', { name: 'draft New pipeline', exact: true }).click();
    await expect(page.locator('#pipelines-input')).toBeEmpty();
    await expect(page.locator('.monaco-editor').nth(0)).toBeEmpty();

    const saveResponse = page.waitForResponse(
      resp => resp.url().includes('api/pipelines/user'), {timeout: 30000}
    );

    await utils.typeInPipelineEditor(
      page,
      'preamble:\n' +
      '   input_reference_genome: hg38/genomes/GRCh38-hg38\n' +
      'annotators:\n' +
      '- allele_score:\n' +
      '    resource_id: hg38/scores/CADD_v1.4\n'
    );

    await saveResponse;

    await page.waitForSelector('.loaded-editor', { state: 'visible', timeout: 120000 });

    await page.getByRole('button', { name: 'Save as' }).click();

    await expect(page.locator('#name-modal')).toBeVisible();
    await page.locator('#name-modal input').fill('My Pipeline');
    await page.locator('#name-modal').getByRole('button', { name: 'Save' }).click();

    await page.waitForSelector('.loaded-editor', { state: 'visible', timeout: 120000 });

    await expect(page.locator('#pipelines-input')).toHaveValue('My Pipeline');
  });

  test('should create new pipeline and use it without saving it', async({ page }) => {
    await page.waitForSelector('.loaded-editor', { state: 'visible', timeout: 120000 });
    await page.locator('#pipeline-actions').getByRole('button', { name: 'draft New pipeline' }).click();

    const saveResponse = page.waitForResponse(
      resp => resp.url().includes('api/pipelines/user'), {timeout: 30000}
    );

    await utils.typeInPipelineEditor(
      page,
      '- effect_annotator:\n' +
      '    gene_models: hg38/gene_models/GENCODE/48/basic/ALL\n' +
      '    genome: hg38/genomes/GRCh38.p13\n' +
      '    attributes:\n' +
      '    - worst_effect\n' +
      '    - gene_effects\n' +
      '    - effect_details\n' +
      '    - name: gene_list \n' +
      '      internal: true\n'
    );

    await saveResponse;

    await page.locator('#examples-button').click();
    await page.getByRole('menuitem', {name: 'chr1 11796321 G A', exact: true}).click();
    await expect(page.locator('#pipelines-input')).toBeEmpty();
    await expect(page.locator('#report')).toBeVisible({timeout: 120000});
  });

  test('should not be able to save pipeline if invalid', async({ page }) => {
    await page.locator('#pipeline-actions').getByRole('button', { name: 'draft New pipeline', exact: true }).click();
    await utils.typeInPipelineEditor(
      page,
      'preamble:\n' +
      'input_reference_genome: hg38/genomes/GRCh38-hg38\n' +
      'annotators:\n' +
      '- allele_score:\n' +
      'resource_id: hg38/scores/CADD_v1.4'
    );
    await page.waitForSelector('.invalid-config', { state: 'visible', timeout: 120000 });
    await expect(page.getByText('Invalid configuration')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Save as' })).toBeDisabled();
  });

  test('should edit public pipeline and annotate with it', async({ page }) => {
    await utils.selectPipeline(page, 'pipeline/Clinical_annotation');
    /* eslint-disable */
    await page.evaluate(() => {
      const monaco = (window as any).monaco;
      const model = monaco.editor.getModels()[0];

      model.applyEdits([
        {
          range: new monaco.Range(19, 1, 88, 1), // clear from line 19 col 1 to line 88 col 1
          text: ''
        }
      ]);
    });
    /* eslint-enable */

    await page.waitForSelector('.loaded-editor', { state: 'visible', timeout: 120000 });
    await expect(page.locator('#pipelines-input')).toBeEmpty();

    await page.locator('#examples-button').click();
    await page.getByRole('menuitem', {name: 'chr1 11796321 G A', exact: true}).click();
    await expect(page.locator('#report')).toBeVisible({timeout: 120000});
  });

  test('should edit user pipeline and save it', async({ page }) => {
    // create pipeline
    await page.locator('#pipeline-actions').getByRole('button', { name: 'draft New pipeline', exact: true }).click();
    await expect(page.locator('#pipelines-input')).toBeEmpty();
    await expect(page.locator('.monaco-editor').nth(0)).toBeEmpty();

    const saveResponse = page.waitForResponse(
      resp => resp.url().includes('api/pipelines/user'), {timeout: 30000}
    );

    await utils.typeInPipelineEditor(
      page,
      'preamble:\n' +
      '   input_reference_genome: hg38/genomes/GRCh38-hg38\n' +
      'annotators:\n' +
      '- allele_score:\n' +
      '    resource_id: hg38/scores/CADD_v1.4\n'
    );

    await saveResponse;

    await page.waitForSelector('.loaded-editor', { state: 'visible', timeout: 120000 });

    await page.getByRole('button', { name: 'Save as' }).click();

    await expect(page.locator('#name-modal')).toBeVisible();
    await page.locator('#name-modal input').fill('My pipeline');

    await Promise.all([
      page.locator('#name-modal').getByRole('button', { name: 'Save' }).click(),
      page.waitForResponse(
        resp => resp.url().includes('api/pipelines/load') // wait for pipeline to be saved and loaded
      ),
    ]);

    await expect(page.locator('#pipelines-input')).toHaveValue('My pipeline');

    // edit pipeline
    /* eslint-disable */
    await page.evaluate(() => {
      const monaco = (window as any).monaco;
      const model = monaco.editor.getModels()[0];

      model.applyEdits([
        {
          range: new monaco.Range(6, 1, 13, 1),
          text: '- position_score_annotator:\n' +
                '    attributes:\n' +
                '    - internal: false\n' +
                '      name: fitcons2_e035\n' +
                '      source: FitCons2_E035\n' +
                '    resource_id: hg19/scores/FitCons2_E035'
        }
      ]);
    });
    /* eslint-enable */

    await expect(page.locator('#pipelines-input')).toHaveValue('My pipeline *');
    await page.locator('#save-button').click();
    await expect(page.locator('#pipelines-input')).toHaveValue('My pipeline');
  });

  test('should delete user pipeline', async({ page }) => {
    // create pipeline
    await page.locator('#pipeline-actions').getByRole('button', { name: 'draft New pipeline', exact: true }).click();
    await expect(page.locator('#pipelines-input')).toBeEmpty();
    await expect(page.locator('.monaco-editor').nth(0)).toBeEmpty();

    const saveResponse = page.waitForResponse(
      resp => resp.url().includes('api/pipelines/user'), {timeout: 30000}
    );

    await utils.typeInPipelineEditor(
      page,
      'preamble:\n' +
      '   input_reference_genome: hg38/genomes/GRCh38-hg38\n' +
      'annotators:\n' +
      '- allele_score:\n' +
      '    resource_id: hg38/scores/CADD_v1.4\n'
    );

    await saveResponse;

    await page.waitForSelector('.loaded-editor', { state: 'visible', timeout: 120000 });

    await page.getByRole('button', { name: 'Save as' }).click();

    await expect(page.locator('#name-modal')).toBeVisible();
    await page.locator('#name-modal input').fill('My pipeline');

    await Promise.all([
      page.locator('#name-modal').getByRole('button', { name: 'Save' }).click(),
      page.waitForResponse(
        resp => resp.url().includes('api/pipelines/load') // wait for pipeline to be saved and loaded
      ),
    ]);

    await page.getByRole('button', { name: 'Delete' }).click();
    await page.locator('#confirm-delete').click();
    await expect(page.locator('#pipelines-input')).toHaveValue('pipeline/Autism_annotation');
  });

  test('should make copy of public pipeline by clicking \'save as\'', async({ page }) => {
    await utils.selectPipeline(page, 'pipeline/Clinical_annotation');
    await page.getByRole('button', { name: 'Save as' }).click();

    await expect(page.locator('#name-modal')).toBeVisible();
    await page.locator('#name-modal input').fill('Public pipeline copy');

    await Promise.all([
      page.locator('#name-modal').getByRole('button', { name: 'Save' }).click(),
      page.waitForResponse(
        resp => resp.url().includes('api/pipelines/load') // wait for pipeline to be saved and loaded
      ),
    ]);

    await expect(page.locator('#pipelines-input')).toHaveValue('Public pipeline copy');
  });

  test('should make copy of user pipeline by clicking \'save as\'', async({ page }) => {
    // create pipeline
    await page.locator('#pipeline-actions').getByRole('button', { name: 'draft New pipeline', exact: true }).click();
    await expect(page.locator('#pipelines-input')).toBeEmpty();
    await expect(page.locator('.monaco-editor').nth(0)).toBeEmpty();

    const saveResponse = page.waitForResponse(
      resp => resp.url().includes('api/pipelines/user'), {timeout: 30000}
    );

    await utils.typeInPipelineEditor(
      page,
      'preamble:\n' +
      '   input_reference_genome: hg38/genomes/GRCh38-hg38\n' +
      'annotators:\n' +
      '- allele_score:\n' +
      '    resource_id: hg38/scores/CADD_v1.4\n'
    );

    await saveResponse;

    await page.waitForSelector('.loaded-editor', { state: 'visible', timeout: 120000 });

    await page.getByRole('button', { name: 'Save as' }).click();

    await expect(page.locator('#name-modal')).toBeVisible();
    await page.locator('#name-modal input').fill('My pipeline');

    await Promise.all([
      page.locator('#name-modal').getByRole('button', { name: 'Save' }).click(),
      page.waitForResponse(
        resp => resp.url().includes('api/pipelines/load') // wait for pipeline to be saved and loaded
      ),
    ]);

    await page.getByRole('button', { name: 'Save as' }).click();

    await expect(page.locator('#name-modal')).toBeVisible();
    await page.locator('#name-modal input').fill('User pipeline copy');

    await Promise.all([
      page.locator('#name-modal').getByRole('button', { name: 'Save' }).click(),
      page.waitForResponse(
        resp => resp.url().includes('api/pipelines/load') // wait for pipeline to be saved and loaded
      ),
    ]);

    await expect(page.locator('#pipelines-input')).toHaveValue('User pipeline copy');
    await expect(page.locator('.monaco-editor').nth(0)).toHaveText(
      // eslint-disable-next-line max-len
      'preamble:   input_reference_genome: hg38/genomes/GRCh38-hg38annotators:- allele_score:    resource_id: hg38/scores/CADD_v1.4'
    );
  });

  test('should not be able to delete and save public pipeline', async({ page }) => {
    await expect(page.locator('#pipelines-input')).toHaveValue('pipeline/Autism_annotation');
    await expect(page.getByRole('button', { name: 'Delete' })).not.toBeVisible();
    await expect(page.getByRole('button', { name: 'Save', exact: true })).not.toBeVisible();
  });

  test('should search and select pipeline from dropdown', async({ page }) => {
    await page.locator('#pipelines-input').fill('clini');
    await expect(page.locator('mat-option')).toHaveCount(4);
    await expect(page.getByTitle('pipeline/Clinical_annotation')).toBeVisible();
    await expect(page.getByTitle('pipeline/T2T_Clinical_annotation')).toBeVisible();
    await expect(page.getByTitle('pipeline/hg38_Clinical_annotation')).toBeVisible();
    await expect(page.getByTitle('pipeline/hg19_Clinical_annotation')).toBeVisible();
  });

  test('should search for nonexistent pipeline in dropdown', async({ page }) => {
    await page.locator('#pipelines-input').fill('piepline');
    await expect(page.locator('mat-option')).toHaveCount(0);
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
    await page.locator('#pipeline-actions').getByRole('button', { name: 'draft New pipeline', exact: true }).click();
    await utils.typeInPipelineEditor(page, 'preamble:\n input_reference_genome: hg38/genomes/GRCh38-hg38');
    await page.waitForSelector('.invalid-config', { state: 'visible', timeout: 120000 });
    await expect(page.getByText('Invalid configuration, reason: \'annotators\'')).toBeVisible();
  });

  test('should type config without peamble and show error message', async({ page }) => {
    await page.locator('#pipeline-actions').getByRole('button', { name: 'draft New pipeline', exact: true }).click();
    await utils.typeInPipelineEditor(page, 'annotators:\n - allele_score: hg38/scores/CADD_v1.4');
    await page.waitForSelector('.invalid-config', { state: 'visible', timeout: 120000 });
    await expect(page.getByText('Invalid configuration, reason: \'preamble\'')).toBeVisible();
  });

  test('should type semantically invalid config and see error', async({ page }) => {
    await page.locator('#pipeline-actions').getByRole('button', { name: 'draft New pipeline', exact: true }).click();
    await utils.typeInPipelineEditor(page, '- allele_score');

    await expect(page.locator('.error-message').nth(0)).toContainText(
      'Invalid configuration, reason: The A0 annotator configuration is incorrect:  ' +
      'The AnnotatorInfo(annotator_id=\'A0\', type=\'allele_score\', attributes=[], ' +
      'parameters={\'work_dir\': \'work/A0_allele_score\'}, documentation=\'\', resources=[]) ' +
      'has not \'resource_id\' parameters');
  });
});

test.describe('Pipeline confirmation popup tests', () => {
  test.beforeEach(async({ page }) => {
    await page.goto('/', {waitUntil: 'load'});

    const email = utils.getRandomString() + '@email.com';
    const password = 'aaabbb';
    await utils.registerUser(page, email, password);

    await utils.loginUser(page, email, password);
    // wait for default pipeline to load
    await page.waitForSelector('.loaded-editor', { state: 'visible', timeout: 120000 });
  });

  const pipelineContent =
    'preamble:\n' +
    '   input_reference_genome: hg38/genomes/GRCh38-hg38\n' +
    'annotators:\n' +
    '- allele_score:\n' +
    '    resource_id: hg38/scores/CADD_v1.4\n';

  async function setupTempPipeline(page: Page): Promise<void> {
    await page.locator('#pipeline-actions').getByRole('button', { name: 'draft New pipeline', exact: true }).click();
    const saveResponse = page.waitForResponse(
      resp => resp.url().includes('api/pipelines/user'), {timeout: 30000}
    );
    await utils.typeInPipelineEditor(page, pipelineContent);
    await saveResponse;
  }

  test('should show confirmation popup when selecting a pipeline with unsaved temp changes', async({ page }) => {
    await setupTempPipeline(page);

    await page.locator('.dropdown-icon').click();

    await expect(page.locator('#change-confirmation-popover')).toBeVisible();
    await expect(page.locator('#change-confirmation-popover p')).toHaveText(
      'Are you sure? You are going to lose your changes.'
    );
    await expect(page.locator('#confirm-change')).toBeVisible();
    await expect(page.locator('#cancel-change')).toBeVisible();
  });

  test('should open pipeline dropdown after confirming pipeline selection', async({ page }) => {
    await setupTempPipeline(page);

    await page.locator('.dropdown-icon').click();
    await expect(page.locator('#change-confirmation-popover')).toBeVisible();

    await page.locator('#confirm-change').click();

    await expect(page.locator('#change-confirmation-popover')).not.toBeVisible();
    await expect(page.locator('#pipelines-input')).toBeEmpty();
    await expect(page.locator('mat-option').first()).toBeVisible();
  });

  test('should keep unsaved changes after cancelling pipeline selection', async({ page }) => {
    await setupTempPipeline(page);

    await page.locator('.dropdown-icon').click();
    await expect(page.locator('#change-confirmation-popover')).toBeVisible();

    await page.locator('#cancel-change').click();

    await expect(page.locator('#change-confirmation-popover')).not.toBeVisible();
    await expect(page.locator('.monaco-editor').nth(0)).toHaveText(
      'preamble:' +
      ' input_reference_genome: hg38/genomes/GRCh38-hg38' +
      'annotators:' +
      '- allele_score:' +
      '   resource_id: hg38/scores/CADD_v1.4');
  });

  test('should show confirmation popup when clicking "New pipeline" with unsaved temp changes', async({ page }) => {
    await setupTempPipeline(page);

    await page.locator('#pipeline-actions').getByRole('button', { name: 'draft New pipeline', exact: true }).click();

    await expect(page.locator('#change-confirmation-popover')).toBeVisible();
    await expect(page.locator('#change-confirmation-popover p')).toHaveText(
      'Are you sure? You are going to lose your changes.'
    );
    await expect(page.locator('#confirm-change')).toBeVisible();
    await expect(page.locator('#cancel-change')).toBeVisible();
  });

  test('should clear pipeline after confirming new pipeline creation', async({ page }) => {
    await setupTempPipeline(page);

    await page.locator('#pipeline-actions').getByRole('button', { name: 'draft New pipeline', exact: true }).click();
    await expect(page.locator('#change-confirmation-popover')).toBeVisible();

    await page.locator('#confirm-change').click();

    await expect(page.locator('#change-confirmation-popover')).not.toBeVisible();
    await expect(page.locator('#pipelines-input')).toBeEmpty();
    await expect(page.locator('.monaco-editor').nth(0)).toBeEmpty();
  });

  test('should keep unsaved changes after cancelling new pipeline creation', async({ page }) => {
    await setupTempPipeline(page);

    await page.locator('#pipeline-actions').getByRole('button', { name: 'draft New pipeline', exact: true }).click();
    await expect(page.locator('#change-confirmation-popover')).toBeVisible();

    await page.locator('#cancel-change').click();

    await expect(page.locator('#change-confirmation-popover')).not.toBeVisible();
    await expect(page.locator('.monaco-editor').nth(0)).not.toBeEmpty();
  });

  test('should show confirmation popup when selecting pipeline with unsaved user pipeline changes', async({ page }) => {
    // create and save a user pipeline first
    await page.locator('#pipeline-actions').getByRole('button', { name: 'draft New pipeline', exact: true }).click();

    const saveResponse = page.waitForResponse(
      resp => resp.url().includes('api/pipelines/user'), {timeout: 30000}
    );
    await utils.typeInPipelineEditor(page, pipelineContent);
    await saveResponse;

    await page.waitForSelector('.loaded-editor', { state: 'visible', timeout: 120000 });
    await page.getByRole('button', { name: 'Save as' }).click();
    await expect(page.locator('#name-modal')).toBeVisible();
    await page.locator('#name-modal input').fill('My Pipeline');

    await Promise.all([
      page.locator('#name-modal').getByRole('button', { name: 'Save' }).click(),
      page.waitForResponse(resp => resp.url().includes('api/pipelines/load')),
    ]);

    await expect(page.locator('#pipelines-input')).toHaveValue('My Pipeline');

    // modify the saved pipeline to trigger unsaved indicator (*)
    /* eslint-disable */
    await page.evaluate(() => {
      const monaco = (window as any).monaco;
      const model = monaco.editor.getModels()[0];
      model.applyEdits([{
        range: new monaco.Range(5, 1, 5, 1),
        text: '    # edited\n'
      }]);
    });
    /* eslint-enable */

    await expect(page.locator('#pipelines-input')).toHaveValue('My Pipeline *');

    await page.locator('.dropdown-icon').click();

    await expect(page.locator('#change-confirmation-popover')).toBeVisible();
    await expect(page.locator('#change-confirmation-popover p')).toHaveText(
      'Are you sure? You are going to lose your changes.'
    );
  });
});

test.describe('Add annotator to pipeline tests', () => {
  test.beforeEach(async({ page }) => {
    await page.goto('/', {waitUntil: 'load'});

    const email = utils.getRandomString() + '@email.com';
    const password = 'aaabbb';
    await utils.registerUser(page, email, password);

    await utils.loginUser(page, email, password);
    // wait for default pipeline to load
    await page.waitForSelector('.loaded-editor', { state: 'visible', timeout: 120000});
  });

  test('should open new annotator dialog with correct header and first step', async({ page }) => {
    await page.locator('#pipeline-actions').locator('#add-annotator-button').click();

    await expect(page.locator('mat-dialog-container')).toBeVisible();
    await expect(page.locator('#modal-header')).toHaveText('New annotator');
    await expect(page.getByRole('combobox', { name: 'Select annotator' })).toBeVisible();
  });

  test('should append gene set annotator', async({ page }) => {
    await utils.selectPipeline(page, 'pipeline/Clinical_annotation');
    await page.locator('#pipeline-actions').locator('#add-annotator-button').click();

    await page.getByRole('combobox', { name: 'Select annotator' }).click();
    await page.locator('mat-option').getByText('gene_set_annotator').click();
    await page.getByRole('button', { name: 'Next' }).click();

    await page.locator('[id="resource_id-dropdown"]').click();
    await page.locator('mat-option').getByText('gene_properties/gene_sets/spark').click();
    await page.locator('[id="input_gene_list-dropdown"]').click();
    await page.locator('mat-option').getByText('gene_list').click();
    await page.getByRole('button', { name: 'Next' }).click();

    await expect(page.locator('.attribute-source')).toHaveCount(1);

    await Promise.all([
      page.getByRole('button', { name: 'Finish' }).click(),
      page.waitForResponse(
        resp => resp.url().includes('api/pipelines/validate')
      ),
    ]);

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const value = await page.evaluate(() => {
      // eslint-disable-next-line max-len
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-explicit-any
      return (window as any).monaco.editor.getModels()[0].getValue();
    });

    expect(value).toContain(
      '- gene_set_annotator:\n'+
      '    resource_id: gene_properties/gene_sets/spark\n' +
      '    input_gene_list: gene_list\n'+
      '    attributes:\n'+
      '    - name: in_sets\n'+
      '      source: in_sets\n' +
      '      internal: false\n'
    );
  });

  test('should append two annotators', async({ page }) => {
    await utils.selectPipeline(page, 'pipeline/Clinical_annotation');
    await page.locator('#pipeline-actions').locator('#add-annotator-button').click();

    await page.getByRole('combobox', { name: 'Select annotator' }).click();
    await page.locator('mat-option').getByText('liftover_annotator').click();
    await page.getByRole('button', { name: 'Next' }).click();

    await page.locator('[id="chain-dropdown"]').click();
    await page.locator('mat-option').getByText('liftover/hg19_to_T2T').click();

    await page.locator('[id="source_genome-dropdown"]').click();
    await page.locator('mat-option').getByText('t2t/genomes/t2t-chm13v2.0').click();

    await page.locator('[id="target_genome-dropdown"]').click();
    await page.locator('mat-option').getByText('hg38/genomes/GRCh38.p14').click();
    await page.getByRole('button', { name: 'Next' }).click();

    await Promise.all([
      page.getByRole('button', { name: 'Finish' }).click(),
      page.waitForResponse(
        resp => resp.url().includes('api/pipelines/validate')
      ),
      page.waitForResponse(
        resp => resp.url().includes('api/pipelines/user'), // wait for pipeline to be saved
        {timeout: 20000}, // hg38_to_t2t chain loading can take a while, increase timeout for this test
      ),
    ]);

    await page.waitForSelector('.loaded-editor', { state: 'visible', timeout: 120000 });

    await page.locator('#pipeline-actions').locator('#add-annotator-button').click();

    await page.getByRole('combobox', { name: 'Select annotator' }).click();
    await page.locator('mat-option').getByText('position_score_annotator').click();
    await page.waitForTimeout(3000);
    await page.getByRole('button', { name: 'Next' }).click();

    await page.locator('[id="resource_id-dropdown"]').click();
    await page.locator('mat-option').getByText('hg19/scores/fitCons2/E050').click();

    await page.getByRole('button', { name: 'Next' }).click();

    await Promise.all([
      page.getByRole('button', { name: 'Finish' }).click(),
      page.waitForResponse(
        resp => resp.url().includes('api/pipelines/validate')
      ),
    ]);

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const value = await page.evaluate(() => {
      // eslint-disable-next-line max-len
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-explicit-any
      return (window as any).monaco.editor.getModels()[0].getValue();
    });

    expect(value).toContain(
      '- liftover_annotator:\n' +
      '    chain: liftover/hg19_to_T2T\n' +
      '    source_genome: t2t/genomes/t2t-chm13v2.0\n' +
      '    target_genome: hg38/genomes/GRCh38.p14\n' +
      '    attributes:\n' +
      '    - name: liftover_annotatable\n' +
      '      source: liftover_annotatable\n' +
      '      internal: true\n' +
      '\n' +
      '- position_score_annotator:\n' +
      '    resource_id: hg19/scores/fitCons2/E050\n' +
      '    attributes:\n' +
      '    - name: FitCons2_E050\n' +
      '      source: FitCons2_E050\n' +
      '      internal: false'
    );
  });

  test('should append annotator to user pipeline', async({ page }) => {
    await customDefaultPipeline(page);

    await page.getByRole('button', { name: 'Save as' }).click();

    await expect(page.locator('#name-modal')).toBeVisible();
    await page.locator('#name-modal input').fill('My Pipeline');
    await page.locator('#name-modal').getByRole('button', { name: 'Save' }).click();

    await page.waitForSelector('.loaded-editor', { state: 'visible', timeout: 120000 });
    // append new annotator
    await page.locator('#pipeline-actions').locator('#add-annotator-button').click();

    await page.getByRole('combobox', { name: 'Select annotator' }).click();
    await page.locator('mat-option').getByText('simple_effect_annotator').click();
    await page.getByRole('button', { name: 'Next' }).click();

    await page.locator('[id="gene_models-dropdown"]').click();
    await page.locator('mat-option').getByText('hg19/gene_models/ccds_v201309').click();

    await page.getByRole('button', { name: 'Next' }).click();

    await Promise.all([
      page.getByRole('button', { name: 'Finish' }).click(),
      page.waitForResponse(
        resp => resp.url().includes('api/pipelines/validate')
      ),
    ]);

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const value = await page.evaluate(() => {
      // eslint-disable-next-line max-len
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-explicit-any
      return (window as any).monaco.editor.getModels()[0].getValue();
    });

    expect(value).toContain(
      'preamble:\n' +
      '   input_reference_genome: hg38/genomes/GRCh38-hg38' +
      '\n' +
      'annotators:\n' +
      '- allele_score:\n' +
      '    resource_id: hg38/scores/CADD_v1.4\n' +
      '\n' +
      '- simple_effect_annotator:\n' +
      '    gene_models: hg19/gene_models/ccds_v201309\n' +
      '    attributes:\n' +
      '    - name: worst_effect\n' +
      '      source: worst_effect\n' +
      '      internal: false\n' +
      '    - name: worst_effect_genes\n' +
      '      source: worst_effect_genes\n' +
      '      internal: false\n' +
      '    - name: gene_list\n' +
      '      source: gene_list\n' +
      '      internal: true\n'
    );
  });

  test('should disable Next button when no annotator is selected and enable it after selection', async({ page }) => {
    await page.locator('#pipeline-actions').locator('#add-annotator-button').click();

    await expect(page.getByRole('button', { name: 'Next' })).toBeDisabled();

    await page.getByRole('combobox', { name: 'Select annotator' }).click();
    await page.locator('mat-option').getByText('allele_score').click();

    await expect(page.getByRole('button', { name: 'Next' })).toBeEnabled();
  });

  test('should filter annotators in dropdown by search text', async({ page }) => {
    await page.locator('#pipeline-actions').locator('#add-annotator-button').click();

    await page.getByRole('combobox', { name: 'Select annotator' }).fill('allele');
    await expect(page.locator('.annotator-option')).toHaveCount(2);
    await expect(page.locator('.annotator-option').filter({ hasText: 'allele_score_annotator' })).toBeVisible();
    await expect(page.locator('.annotator-option').filter({ hasText: 'normalize_allele_annotator' })).toBeVisible();
  });

  test('should navigate back from configure step to annotator selection step', async({ page }) => {
    await page.locator('#pipeline-actions').locator('#add-annotator-button').click();

    await page.getByRole('combobox', { name: 'Select annotator' }).click();
    await page.locator('mat-option').getByText('allele_score').click();
    await page.getByRole('button', { name: 'Next' }).click();

    await expect(page.locator('[id="resource_id-dropdown"]')).toBeVisible();

    await page.getByRole('button', { name: 'Back' }).click();

    await expect(page.getByRole('combobox', { name: 'allele_score_annotator' })).toBeVisible();
  });

  test('should remove a default attribute in the attribute step', async({ page }) => {
    await page.locator('#pipeline-actions').locator('#add-annotator-button').click();

    await page.getByRole('combobox', { name: 'Select annotator' }).click();
    await page.locator('mat-option').getByText('simple_effect_annotator').click();
    await page.getByRole('button', { name: 'Next' }).click();

    await page.locator('[id="gene_models-dropdown"]').click();
    await page.locator('mat-option').getByText('hg19/gene_models/ccds_v201309').click();
    await page.getByRole('button', { name: 'Next' }).click();

    await expect(page.locator('.attribute-source')).toHaveCount(3);

    await page.locator('#gene_list-remove-button').click();

    await expect(page.locator('.attribute-source')).toHaveCount(2);
  });

  test('should rename attribute and reflect new name in finished YAML', async({ page }) => {
    await customDefaultPipeline(page);
    await page.locator('#pipeline-actions').locator('#add-annotator-button').click();

    await page.getByRole('combobox', { name: 'Select annotator' }).click();
    await page.locator('mat-option').getByText('simple_effect_annotator').click();
    await page.getByRole('button', { name: 'Next' }).click();

    await page.locator('[id="gene_models-dropdown"]').click();
    await page.locator('mat-option').getByText('hg19/gene_models/ccds_v201309').click();
    await page.getByRole('button', { name: 'Next' }).click();

    await page.locator('.editable-name').first().fill('my_worst_effect');
    await page.locator('.editable-name').first().blur();

    await Promise.all([
      page.getByRole('button', { name: 'Finish' }).click(),
      page.waitForResponse(resp => resp.url().includes('api/pipelines/validate')),
    ]);

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const value = await page.evaluate(() => {
      // eslint-disable-next-line max-len
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-explicit-any
      return (window as any).monaco.editor.getModels()[0].getValue();
    });

    expect(value).toContain('name: my_worst_effect');
    expect(value).not.toContain('name: worst_effect\n');
  });

  test('should show duplicate attribute name error and hide Finish button', async({ page }) => {
    await utils.selectPipeline(page, 'pipeline/Clinical_annotation');
    await page.locator('#pipeline-actions').locator('#add-annotator-button').click();

    await page.getByRole('combobox', { name: 'Select annotator' }).click();
    await page.locator('mat-option').getByText('simple_effect_annotator').click();
    await page.getByRole('button', { name: 'Next' }).click();

    await page.locator('[id="gene_models-dropdown"]').click();
    await page.locator('mat-option').getByText('hg19/gene_models/ccds_v201309').click();
    await page.getByRole('button', { name: 'Next' }).click();

    await expect(page.locator('.attribute-source')).toHaveCount(3);

    await page.locator('.editable-name').first().fill('worst_effect_genes');
    await page.locator('.editable-name').first().blur();

    await expect(page.locator('.error-message')).toContainText('Attribute with this name already exists');
    await expect(page.getByRole('button', { name: 'Finish' })).not.toBeVisible();
  });

  test('should disable New annotator button when pipeline config is invalid', async({ page }) => {
    await page.locator('#pipeline-actions').getByRole('button', { name: 'draft New pipeline', exact: true }).click();
    await utils.typeInPipelineEditor(page, 'preamble:\n input_reference_genome: hg38/genomes/GRCh38-hg38');
    await page.waitForSelector('.invalid-config', { state: 'visible', timeout: 120000 });

    await expect(page.locator('#pipeline-actions').locator('#add-annotator-button')).toBeDisabled();
  });

  test('should enable Next button on configure step only after all required fields are filled', async({ page }) => {
    await page.locator('#pipeline-actions').locator('#add-annotator-button').click();
    await page.getByRole('combobox', { name: 'Select annotator' }).click();
    await page.locator('mat-option').getByText('liftover_annotator').click();
    await page.getByRole('button', { name: 'Next' }).click();

    await page.locator('[id="chain-dropdown"]').click();
    await page.locator('mat-option').getByText('liftover/hg19_to_T2T').click();
    await expect(page.getByRole('button', { name: 'Next' })).toBeDisabled();

    await page.locator('[id="source_genome-dropdown"]').click();
    await page.locator('mat-option').getByText('t2t/genomes/t2t-chm13v2.0').click();
    await expect(page.getByRole('button', { name: 'Next' })).toBeDisabled();

    await page.locator('[id="target_genome-dropdown"]').click();
    await page.locator('mat-option').getByText('hg38/genomes/GRCh38.p14').click();
    await expect(page.getByRole('button', { name: 'Next' })).toBeEnabled();
  });

  test('should enable Next when only required field is filled', async({ page }) => {
    // effect_annotator has gene_models (required) and genome (optional resource)
    await page.locator('#pipeline-actions').locator('#add-annotator-button').click();
    await page.getByRole('combobox', { name: 'Select annotator' }).click();
    await page.locator('mat-option').getByText('effect_annotator', { exact: true }).click();
    await page.getByRole('button', { name: 'Next' }).click();

    await expect(page.locator('[id="gene_models-dropdown"]')).toBeVisible();
    await expect(page.locator('[id="genome-dropdown"]')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Next' })).toBeDisabled();

    await page.locator('[id="gene_models-dropdown"]').click();
    await page.locator('mat-option').getByText('hg19/gene_models/ccds_v201309').click();

    // Next is enabled without filling optional genome field
    await expect(page.getByRole('button', { name: 'Next' })).toBeEnabled();
  });

  test('should keep Next enabled after filling an optional resource field', async({ page }) => {
    // effect_annotator: fill required gene_models then also fill optional genome
    await page.locator('#pipeline-actions').locator('#add-annotator-button').click();
    await page.getByRole('combobox', { name: 'Select annotator' }).click();
    await page.locator('mat-option').getByText('effect_annotator', { exact: true }).click();
    await page.getByRole('button', { name: 'Next' }).click();

    await page.locator('[id="gene_models-dropdown"]').click();
    await page.locator('mat-option').getByText('hg19/gene_models/ccds_v201309').click();
    await expect(page.getByRole('button', { name: 'Next' })).toBeEnabled();

    await page.locator('[id="genome-dropdown"]').click();
    await page.locator('mat-option.resource-option').first().click();
    await expect(page.getByRole('button', { name: 'Next' })).toBeEnabled();
  });

  test('should filter chain options by search text in configure step', async({ page }) => {
    await page.locator('#pipeline-actions').locator('#add-annotator-button').click();
    await page.getByRole('combobox', { name: 'Select annotator' }).click();
    await page.locator('mat-option').getByText('liftover_annotator').click();
    await page.getByRole('button', { name: 'Next' }).click();

    await page.locator('[id="chain-dropdown"]').locator('.dropdown-icon').click();

    await page.locator('[id="chain-dropdown"] input').fill('hg19');
    const filteredOptions = page.locator('mat-option.resource-option');

    expect(await filteredOptions.count()).toBe(6);
  });

  test('should filter source_genome options by search text in configure step', async({ page }) => {
    await page.locator('#pipeline-actions').locator('#add-annotator-button').click();
    await page.getByRole('combobox', { name: 'Select annotator' }).click();
    await page.locator('mat-option').getByText('liftover_annotator').click();
    await page.getByRole('button', { name: 'Next' }).click();

    await page.locator('[id="source_genome-dropdown"]').locator('.dropdown-icon').click();

    await page.locator('[id="source_genome-dropdown"] input').fill('t2t');
    const filteredOptions = page.locator('mat-option.resource-option');

    expect(await filteredOptions.count()).toBe(1);
  });

  test('should disable Next button in configure step when a filled required field is cleared', async({ page }) => {
    await page.locator('#pipeline-actions').locator('#add-annotator-button').click();
    await page.getByRole('combobox', { name: 'Select annotator' }).click();
    await page.locator('mat-option').getByText('liftover_annotator').click();
    await page.getByRole('button', { name: 'Next' }).click();

    await page.locator('[id="chain-dropdown"]').click();
    await page.locator('mat-option').getByText('liftover/hg19_to_T2T').click();
    await page.locator('[id="source_genome-dropdown"]').click();
    await page.locator('mat-option').getByText('t2t/genomes/t2t-chm13v2.0').click();
    await page.locator('[id="target_genome-dropdown"]').click();
    await page.locator('mat-option').getByText('hg38/genomes/GRCh38.p14').click();

    await expect(page.getByRole('button', { name: 'Next' })).toBeEnabled();

    // clicking the dropdown icon clears the field and opens the panel
    await page.locator('[id="chain-dropdown"]').locator('.dropdown-icon').click();
    await page.keyboard.press('Escape');

    await expect(page.getByRole('button', { name: 'Next' })).toBeDisabled();
  });
});


async function customDefaultPipeline(page: Page): Promise<void> {
  await page.locator('#pipeline-actions').getByRole('button', { name: 'draft New pipeline', exact: true }).click();
  await expect(page.locator('#pipelines-input')).toBeEmpty();
  await expect(page.locator('.monaco-editor').nth(0)).toBeEmpty();

  const saveResponse = page.waitForResponse(
    resp => resp.url().includes('api/pipelines/user'), {timeout: 30000}
  );

  await utils.typeInPipelineEditor(
    page,
    'preamble:\n' +
    '   input_reference_genome: hg38/genomes/GRCh38-hg38\n' +
    'annotators:\n' +
    '- allele_score:\n' +
    '    resource_id: hg38/scores/CADD_v1.4\n'
  );

  await saveResponse;

  await page.waitForSelector('.loaded-editor', { state: 'visible', timeout: 120000 });
}