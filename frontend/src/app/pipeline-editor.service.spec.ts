import { TestBed } from '@angular/core/testing';

import { PipelineEditorService } from './pipeline-editor.service';
import { HttpClient, HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { of, lastValueFrom, take, throwError } from 'rxjs';
import {
  AnnotatorConfig,
  AttributeData,
  AttributePage,
  Resource,
  ResourceAnnotator,
  ResourceAnnotatorConfigs
} from './new-annotator/annotator';

describe('PipelineEditorService', () => {
  let service: PipelineEditorService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
      ]
    });
    service = TestBed.inject(PipelineEditorService);
    jest.clearAllMocks();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should get list of annotators', async() => {
    const httpGetSpy = jest.spyOn(HttpClient.prototype, 'get');
    httpGetSpy.mockReturnValue(of([
      'gene_set_annotator',
      'liftover_annotator',
      'position_score',
    ]));

    const getResponse = service.getAnnotators();

    expect(httpGetSpy).toHaveBeenCalledWith(
      '//localhost:8000/api/editor/annotator_types'
    );
    const res = await lastValueFrom(getResponse.pipe(take(1)));
    expect(res).toStrictEqual([
      'gene_set_annotator',
      'liftover_annotator',
      'position_score',
    ]);
  });

  it('should get annotator config', async() => {
    const httpPostSpy = jest.spyOn(HttpClient.prototype, 'post');
    httpPostSpy.mockReturnValue(of(
      /* eslint-disable camelcase */
      {
        annotator_type: 'position_score',
        documentation_url: 'annotatorUrl',
        resource_id: {
          field_type: 'resource',
          resource_type: 'position_score',
          optional: false
        },
        input_annotatable: {
          field_type: 'attribute',
          optional: true,
          attribute_type: 'annotatable'
        }
      }
      /* eslint-enable */
    ));

    jest.spyOn(service, 'getResources').mockReturnValue(of([
      'hg19/scores/FitCons-i6-merged',
      'hg19/scores/FitCons2_E035',
      'hg19/scores/FitCons2_E067',
    ]));

    const options = { headers: {'X-CSRFToken': ''}, withCredentials: true };
    const getResponse = service.getAnnotatorConfig('position_score');

    expect(httpPostSpy).toHaveBeenCalledWith(
      '//localhost:8000/api/editor/annotator_config',
      // eslint-disable-next-line camelcase
      {annotator_type: 'position_score'},
      options
    );
    const res = await lastValueFrom(getResponse.pipe(take(1)));
    expect(res).toStrictEqual(new AnnotatorConfig(
      'position_score',
      'annotatorUrl',
      [
        new Resource(
          'resource_id', 'resource', 'position_score', '', [
            'hg19/scores/FitCons-i6-merged',
            'hg19/scores/FitCons2_E035',
            'hg19/scores/FitCons2_E067',
          ],
          false,
          ''
        ),
        new Resource('input_annotatable', 'attribute', '', '', null, true, 'annotatable'),
      ],
    ));
  });

  it('should get annotator config without resource of type resource', async() => {
    const httpPostSpy = jest.spyOn(HttpClient.prototype, 'post');
    httpPostSpy.mockReturnValue(of(
      /* eslint-disable camelcase */
      {
        annotator_type: 'gene_set_annotator',
        documentation_url: 'annotatorUrl',
        input_gene_list: {
          field_type: 'string',
          optional: false
        },
        input_annotatable: {
          field_type: 'attribute',
          optional: true,
          attribute_type: 'annotatable'
        }
      }
      /* eslint-enable */
    ));

    const options = { headers: {'X-CSRFToken': ''}, withCredentials: true };
    const getResponse = service.getAnnotatorConfig('gene_set_annotator');

    expect(httpPostSpy).toHaveBeenCalledWith(
      '//localhost:8000/api/editor/annotator_config',
      // eslint-disable-next-line camelcase
      {annotator_type: 'gene_set_annotator'},
      options
    );
    const res = await lastValueFrom(getResponse.pipe(take(1)));
    expect(res).toStrictEqual(new AnnotatorConfig(
      'gene_set_annotator',
      'annotatorUrl',
      [
        new Resource('input_gene_list', 'string', '', '', null, false, ''),
        new Resource('input_annotatable', 'attribute', '', '', null, true, 'annotatable'),
      ]
    ));
  });

  it('should get resources of annotator type', async() => {
    const httpGetSpy = jest.spyOn(HttpClient.prototype, 'get');
    httpGetSpy.mockReturnValue(of([
      'hg19/scores/FitCons-i6-merged',
      'hg19/scores/FitCons2_E035',
      'hg19/scores/FitCons2_E067',
    ]));
    const options = { headers: {'X-CSRFToken': ''}, withCredentials: true };
    const getResponse = service.getResources('position_score');

    expect(httpGetSpy).toHaveBeenCalledWith(
      '//localhost:8000/api/resources?type=position_score',
      options
    );
    const res = await lastValueFrom(getResponse.pipe(take(1)));
    expect(res).toStrictEqual([
      'hg19/scores/FitCons-i6-merged',
      'hg19/scores/FitCons2_E035',
      'hg19/scores/FitCons2_E067',
    ]);
  });

  it('should get attributes of annotator type', async() => {
    const httpPostSpy = jest.spyOn(HttpClient.prototype, 'post');
    httpPostSpy.mockReturnValue(of({
      attributes: [{
        name: 'fitcons_i6_merged',
        source: 'fc_i6_score',
        type: 'float',
        internal: false,
        default: true,
        description: 'probability that a point mutation at each position in a genome will influence fitness'
      }],
      page: 0,
      // eslint-disable-next-line camelcase
      total_pages: 1,
      // eslint-disable-next-line camelcase
      total_attributes: 1,
    }));

    const options = { headers: {'X-CSRFToken': ''}, withCredentials: true };
    const getResponse = service.getAttributes(
      'pipelineId',
      'position_score',
      // eslint-disable-next-line camelcase
      { resource_id: 'hg19/scores/FitCons-i6-merged' }
    );

    expect(httpPostSpy).toHaveBeenCalledWith(
      '//localhost:8000/api/editor/annotator_attributes',
      // eslint-disable-next-line camelcase
      {pipeline_id: 'pipelineId', annotator_type: 'position_score', resource_id: 'hg19/scores/FitCons-i6-merged'},
      options
    );
    const res = await lastValueFrom(getResponse.pipe(take(1)));
    expect(res).toStrictEqual(
      new AttributePage(
        [
          new AttributeData(
            'fitcons_i6_merged',
            'float',
            'fc_i6_score',
            false,
            true,
            'probability that a point mutation at each position in a genome will influence fitness'
          ),
        ],
        0,
        1,
        1
      )
    );
  });

  it('should get attributes of pipeline', async() => {
    const httpGetSpy = jest.spyOn(HttpClient.prototype, 'get');
    httpGetSpy.mockReturnValue(of(['normalized_allele', 'hg19_annotatable']));

    const options = { headers: {'X-CSRFToken': ''}, withCredentials: true };
    const getResponse = service.getPipelineAttributes(
      'pipelineId',
      'input_annotatable',
    );

    expect(httpGetSpy).toHaveBeenCalledWith(
      '//localhost:8000/api/editor/pipeline_attributes?pipeline_id=pipelineId&attribute_type=input_annotatable',
      options
    );
    const res = await lastValueFrom(getResponse.pipe(take(1)));
    expect(res).toStrictEqual(['normalized_allele', 'hg19_annotatable']);
  });

  it('should get yml config text', async() => {
    const yml = '- liftover_annotator:\n    '+
    'attributes:\n    '+
    '- internal: true\n      '+
    'name: liftover_annotatable\n      '+
    'source: liftover_annotatable\n      '+
    'type: annotatable\n    '+
    'chain: liftover/T2T_to_hg38\n    '+
    'source_genome: hg38/genomes/GRCh38-hg38\n    ' +
    'target_genome: hg19/genomes/GATK_ResourceBundle_5777_b37_phiX174\n';

    const httpPostSpy = jest.spyOn(HttpClient.prototype, 'post');
    httpPostSpy.mockReturnValue(of(yml));

    const options = { headers: {'X-CSRFToken': ''}, withCredentials: true };
    const getResponse = service.getAnnotatorYml(
      'pipelineId',
      'liftover_annotator',
      {
        chain: 'liftover/T2T_to_hg38',
        // eslint-disable-next-line camelcase
        source_genome: 'hg38/genomes/GRCh38-hg38',
        // eslint-disable-next-line camelcase
        target_genome: 'hg19/genomes/GATK_ResourceBundle_5777_b37_phiX174'
      },
      [
        new AttributeData(
          'liftover_annotatable',
          'annotatable',
          'liftover_annotatable',
          true,
          true,
          'The lifted over annotatable'
        )
      ]
    );

    expect(httpPostSpy).toHaveBeenCalledWith(
      '//localhost:8000/api/editor/annotator_yaml',
      {
        // eslint-disable-next-line camelcase
        pipeline_id: 'pipelineId',
        attributes: [
          {name: 'liftover_annotatable', source: 'liftover_annotatable', internal: true,}
        ],
        // eslint-disable-next-line camelcase
        annotator_type: 'liftover_annotator',
        chain: 'liftover/T2T_to_hg38',
        // eslint-disable-next-line camelcase
        source_genome: 'hg38/genomes/GRCh38-hg38',
        // eslint-disable-next-line camelcase
        target_genome: 'hg19/genomes/GATK_ResourceBundle_5777_b37_phiX174'
      },
      options
    );
    const res = await lastValueFrom(getResponse.pipe(take(1)));
    expect(res).toStrictEqual(yml);
  });

  it('should catch error 400 when requesting yml', async() => {
    const httpError = new HttpErrorResponse({status: 400, error: {error: 'Invalid annotator configuration!'}});
    const httpPostSpy = jest.spyOn(HttpClient.prototype, 'post');
    httpPostSpy.mockReturnValue(throwError(() => httpError));

    const postResult = service.getAnnotatorYml(
      'pipelineId',
      'liftover_annotator',
      {
        chain: 'liftover/T2T_to_hg38',
        // eslint-disable-next-line camelcase
        source_genome: 'hg38/genomes/GRCh38-hg38',
        // eslint-disable-next-line camelcase
        target_genome: 'hg19/genomes/GATK_ResourceBundle_5777_b37_phiX174'
      },
      [
        new AttributeData(
          'liftover_annotatable',
          'annotatable',
          'liftover_annotatable',
          true,
          true,
          'The lifted over annotatable'
        )
      ]
    );

    await expect(() => lastValueFrom(postResult.pipe(take(1))))
      .rejects.toThrow('Invalid annotator configuration!');
  });

  it('should return default error message when requesting yml fails', async() => {
    const httpError = new HttpErrorResponse({status: 415});
    const httpPostSpy = jest.spyOn(HttpClient.prototype, 'post');
    httpPostSpy.mockReturnValue(throwError(() => httpError));

    const postResult = service.getAnnotatorYml(
      'pipelineId',
      'liftover_annotator',
      {
        chain: 'liftover/T2T_to_hg38',
        // eslint-disable-next-line camelcase
        source_genome: 'hg38/genomes/GRCh38-hg38',
        // eslint-disable-next-line camelcase
        target_genome: 'hg19/genomes/GATK_ResourceBundle_5777_b37_phiX174'
      },
      [
        new AttributeData(
          'liftover_annotatable',
          'annotatable',
          'liftover_annotatable',
          true,
          true,
          'The lifted over annotatable'
        )
      ]
    );

    await expect(() => lastValueFrom(postResult.pipe(take(1))))
      .rejects.toThrow('Error occurred!');
  });

  it('should get resource types', async() => {
    const httpGetSpy = jest.spyOn(HttpClient.prototype, 'get');
    httpGetSpy.mockReturnValue(of([
      'gene_models',
      'position_score',
      'allele_score',
    ]));

    const getResponse = service.getResourceTypes();

    expect(httpGetSpy).toHaveBeenCalledWith(
      '//localhost:8000/api/resources/types'
    );
    const res = await lastValueFrom(getResponse.pipe(take(1)));
    expect(res).toStrictEqual([
      'gene_models',
      'position_score',
      'allele_score',
    ]);
  });

  it('should get resources by search value', async() => {
    const httpGetSpy = jest.spyOn(HttpClient.prototype, 'get');
    httpGetSpy.mockReturnValue(of([
      'hg38/scores/CADD_v1.6',
      'hg19/scores/CADD',
      'hg38/scores/CADD_v1.4',
      'hg38/scores/CADD_v1.7',
    ]));

    const getResponse = service.getResourcesBySearch('cadd', 'allele_score');

    expect(httpGetSpy).toHaveBeenCalledWith(
      '//localhost:8000/api/resources?type=allele_score&search=cadd'
    );
    const res = await lastValueFrom(getResponse.pipe(take(1)));
    expect(res).toStrictEqual([
      'hg38/scores/CADD_v1.6',
      'hg19/scores/CADD',
      'hg38/scores/CADD_v1.4',
      'hg38/scores/CADD_v1.7',
    ]);
  });

  it('should get annotators of a resource', async() => {
    const httpGetSpy = jest.spyOn(HttpClient.prototype, 'get');
    httpGetSpy.mockReturnValue(of({
      default: 'allele_score',
      configs: {
        // eslint-disable-next-line camelcase
        allele_score: {annotator_type: 'allele_score', resource_id: 'hg19/scores/CADD'}
      }
    }));

    const getResponse = service.getResourceAnnotators('hg19/scores/CADD');

    expect(httpGetSpy).toHaveBeenCalledWith(
      '//localhost:8000/api/editor/resource_annotators?resource_id=hg19/scores/CADD'
    );
    const res = await lastValueFrom(getResponse.pipe(take(1)));
    expect(res).toStrictEqual(
      new ResourceAnnotatorConfigs(
        'allele_score',
        [new ResourceAnnotator('allele_score', '{"resource_id":"hg19/scores/CADD"}')]
      )
    );
  });

  it('should get all attribute names of a pipeline', async() => {
    const httpGetSpy = jest.spyOn(HttpClient.prototype, 'get');
    // eslint-disable-next-line camelcase
    httpGetSpy.mockReturnValue(of(
      [
        'normalized_allele',
        'CLNSIG',
        'CLNDN',
        'hg19_annotatable',
        'mpc',
      ]
    ));

    const getResponse = service.getPipelineAttributesNames('pipelineId');

    expect(httpGetSpy).toHaveBeenCalledWith(
      '//localhost:8000/api/editor/pipeline_attributes?pipeline_id=pipelineId',
      { headers: { 'X-CSRFToken': '' }, withCredentials: true }
    );
    const res = await lastValueFrom(getResponse.pipe(take(1)));
    expect(res).toStrictEqual([
      'normalized_allele',
      'CLNSIG',
      'CLNDN',
      'hg19_annotatable',
      'mpc',
    ]);
  });

  it('should get attribute names of a pipeline with specific attribute type', async() => {
    const httpGetSpy = jest.spyOn(HttpClient.prototype, 'get');
    // eslint-disable-next-line camelcase
    httpGetSpy.mockReturnValue(of(['cadd_phred', 'cadd_raw']));

    const getResponse = service.getPipelineAttributesNames('pipelineId', 'str');

    expect(httpGetSpy).toHaveBeenCalledWith(
      '//localhost:8000/api/editor/pipeline_attributes?pipeline_id=pipelineId&attribute_type=str',
      { headers: { 'X-CSRFToken': '' }, withCredentials: true }
    );
    const res = await lastValueFrom(getResponse.pipe(take(1)));
    expect(res).toStrictEqual(['cadd_phred', 'cadd_raw']);
  });
});
