import { test, expect } from '@playwright/test';
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
    await page.locator('#pipeline-actions').getByRole('button', { name: 'draft New', exact: true }).click();
    await expect(page.locator('#pipelines-input')).toBeEmpty();
    await expect(page.locator('.monaco-editor').nth(0)).toBeEmpty();

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    await page.evaluate(() => {
      // eslint-disable-next-line max-len
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-explicit-any
      (window as any).monaco.editor.getModels()[0].setValue(
        'preamble:\n' +
        '   input_reference_genome: hg38/genomes/GRCh38-hg38\n' +
        'annotators:\n' +
        '- allele_score:\n' +
        '    resource_id: hg38/scores/CADD_v1.4\n'
      );
    });

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
    await page.locator('#pipeline-actions').getByRole('button', { name: 'draft New' }).click();

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    await page.evaluate(() => {
      // eslint-disable-next-line max-len
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-explicit-any
      (window as any).monaco.editor.getModels()[0].setValue(
        '- cnv_collection:\n' +
        '    resource_id: hg38/cnv_collections/Iossifov_Lab_SSC_AGRE_2021\n' +
        '    cnv_filter: >\n' +
        '        cnv.attributes["affected_status"] == "affected" and\n' +
        '        cnv.attributes["variant"] == "deletion"\n' +
        '    attributes:\n' +
        '    - name: number_of_deletions_in_SSC_affected\n' +
        '      source: count\n'
      );
    });

    await page.waitForResponse(
      resp => resp.url().includes('api/pipelines/user'), {timeout: 30000}
    );


    await page.locator('.example').click();
    await expect(page.locator('#pipelines-input')).toBeEmpty();
    await expect(page.locator('#report')).toBeVisible();
  });

  test('should not be able to save pipeline if invalid', async({ page }) => {
    await page.locator('#pipeline-actions').getByRole('button', { name: 'draft New', exact: true }).click();
    await expect(page.locator('#pipelines-input')).toBeEmpty();
    await expect(page.locator('.monaco-editor').nth(0)).toBeEmpty();

    await utils.clearPipelineEditor(page);
    await utils.typeInPipelineEditor(page, 'preamble:\ninput_reference_genome: hg38/genomes/GRCh38-hg38\n');
    await utils.typeInPipelineEditor(page, 'annotators:\n- allele_score:\n\tresource_id: hg38/scores/CADD_v1.4');

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
          range: new monaco.Range(16, 1, 86, 1), // clear from line 15 col 1 to line 135 col 1
          text: ''
        }
      ]);
    });
    /* eslint-enable */

    await page.waitForSelector('.loaded-editor', { state: 'visible', timeout: 120000 });
    await expect(page.locator('#pipelines-input')).toBeEmpty();

    await page.locator('.example').click();
    await expect(page.locator('#report')).toBeVisible();
  });

  test('should edit user pipeline and save it', async({ page }) => {
    // create pipeline
    await page.locator('#pipeline-actions').getByRole('button', { name: 'draft New', exact: true }).click();
    await expect(page.locator('#pipelines-input')).toBeEmpty();
    await expect(page.locator('.monaco-editor').nth(0)).toBeEmpty();

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    await page.evaluate(() => {
      // eslint-disable-next-line max-len
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-explicit-any
      (window as any).monaco.editor.getModels()[0].setValue(
        'preamble:\n' +
        '   input_reference_genome: hg38/genomes/GRCh38-hg38\n' +
        'annotators:\n' +
        '- allele_score:\n' +
        '    resource_id: hg38/scores/CADD_v1.4\n'
      );
    });

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

    // edit pipeline
    /* eslint-disable */
    await page.evaluate(() => {
      const monaco = (window as any).monaco;
      const model = monaco.editor.getModels()[0];

      model.applyEdits([
        {
          range: new monaco.Range(6, 1, 13, 1),
          text: '- position_score:\n' +
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
    await page.locator('#pipeline-actions').getByRole('button', { name: 'draft New', exact: true }).click();
    await expect(page.locator('#pipelines-input')).toBeEmpty();
    await expect(page.locator('.monaco-editor').nth(0)).toBeEmpty();

    // // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    await page.evaluate(() => {
      // eslint-disable-next-line max-len
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-explicit-any
      (window as any).monaco.editor.getModels()[0].setValue(
        'preamble:\n' +
        '   input_reference_genome: hg38/genomes/GRCh38-hg38\n' +
        'annotators:\n' +
        '- allele_score:\n' +
        '    resource_id: hg38/scores/CADD_v1.4\n'
      );
    });

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
    await page.locator('#pipeline-actions').getByRole('button', { name: 'draft New', exact: true }).click();
    await expect(page.locator('#pipelines-input')).toBeEmpty();
    await expect(page.locator('.monaco-editor').nth(0)).toBeEmpty();

    // // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    await page.evaluate(() => {
      // eslint-disable-next-line max-len
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-explicit-any
      (window as any).monaco.editor.getModels()[0].setValue(
        'preamble:\n' +
        '   input_reference_genome: hg38/genomes/GRCh38-hg38\n' +
        'annotators:\n' +
        '- allele_score:\n' +
        '    resource_id: hg38/scores/CADD_v1.4\n'
      );
    });

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
    await expect(page.locator('mat-option')).toHaveCount(2);
    await expect(page.getByTitle('pipeline/Clinical_annotation')).toBeVisible();
    await expect(page.getByTitle('pipeline/T2T_Clinical_annotation')).toBeVisible();
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

  test('should append gene set annotator', async({ page }) => {
    await page.locator('#pipeline-actions').locator('#add-annotator-button').click();

    await page.getByRole('combobox', { name: 'Select annotator' }).click();
    await page.locator('mat-option').getByText('gene_set_annotator').click();
    await page.getByRole('button', { name: 'Next' }).click();

    await page.locator('[id="resource_id-dropdown"]').click();
    await page.locator('mat-option').getByText('gene_properties/gene_sets/spark').click();
    await page.locator('[id="input_gene_list-dropdown"]').click();
    await page.locator('mat-option').getByText('gene_list').click();
    await page.getByRole('button', { name: 'Next' }).click();

    await expect(page.locator('.attribute-group')).toHaveCount(4);
    await page.getByRole('button', { name: 'Next' }).click();

    await page.getByRole('checkbox').nth(1).uncheck();
    await page.getByRole('checkbox').nth(2).uncheck();
    await page.getByRole('checkbox').nth(3).uncheck();

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
      '    attributes:\n'+
      '    - internal: false\n'+
      '      name: SPARK Gene list ALL 2016,2017\n'+
      '      source: SPARK Gene list ALL 2016,2017\n'+
      '    input_gene_list: gene_list\n'+
      '    resource_id: gene_properties/gene_sets/spark\n'
    );
  });

  test('should append two annotators', async({ page }) => {
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
        resp => resp.url().includes('api/pipelines/user') // wait for pipeline to be saved
      ),
    ]);

    await page.waitForSelector('.loaded-editor', { state: 'visible', timeout: 120000 });

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
      '- liftover_annotator:\n' +
      '    attributes:\n' +
      '    - internal: true\n' +
      '      name: liftover_annotatable\n' +
      '      source: liftover_annotatable\n' +
      '    chain: liftover/hg19_to_T2T\n' +
      '    source_genome: t2t/genomes/t2t-chm13v2.0\n' +
      '    target_genome: hg38/genomes/GRCh38.p14\n' +
      '\n' +
      '- simple_effect_annotator:\n' +
      '    attributes:\n' +
      '    - internal: false\n' +
      '      name: worst_effect\n' +
      '      source: worst_effect\n' +
      '    - internal: false\n' +
      '      name: worst_effect_genes\n' +
      '      source: worst_effect_genes\n' +
      '    - internal: true\n' +
      '      name: gene_list\n' +
      '      source: gene_list\n' +
      '    gene_models: hg19/gene_models/ccds_v201309\n'
    );
  });

  test('should append annotator to user pipeline', async({ page }) => {
    // create pipeline
    await page.locator('#pipeline-actions').getByRole('button', { name: 'draft New', exact: true }).click();
    await expect(page.locator('#pipelines-input')).toBeEmpty();
    await expect(page.locator('.monaco-editor').nth(0)).toBeEmpty();

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    await page.evaluate(() => {
      // eslint-disable-next-line max-len
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-explicit-any
      (window as any).monaco.editor.getModels()[0].setValue(
        'preamble:\n' +
        '   input_reference_genome: hg38/genomes/GRCh38-hg38\n' +
        'annotators:\n' +
        '- allele_score:\n' +
        '    resource_id: hg38/scores/CADD_v1.4\n'
      );
    });

    await page.waitForSelector('.loaded-editor', { state: 'visible', timeout: 120000 });

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
      '    attributes:\n' +
      '    - internal: false\n' +
      '      name: worst_effect\n' +
      '      source: worst_effect\n' +
      '    - internal: false\n' +
      '      name: worst_effect_genes\n' +
      '      source: worst_effect_genes\n' +
      '    - internal: true\n' +
      '      name: gene_list\n' +
      '      source: gene_list\n' +
      '    gene_models: hg19/gene_models/ccds_v201309\n'
    );
  });
});
