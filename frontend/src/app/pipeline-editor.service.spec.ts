import { TestBed } from '@angular/core/testing';

import { PipelineEditorService } from './pipeline-editor.service';
import { HttpClient, provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { of, lastValueFrom, take } from 'rxjs';
import { AnnotatorAttribute, AnnotatorConfig, Resource } from './new-annotator/annotator';

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
        resource_id: {
          field_type: 'resource',
          resource_type: 'position_score'
        },
        input_annotatable: {
          field_type: 'string'
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
      '',
      [
        new Resource('resource_id', 'resource', 'position_score', '', [
          'hg19/scores/FitCons-i6-merged',
          'hg19/scores/FitCons2_E035',
          'hg19/scores/FitCons2_E067',
        ]),
      ]
    ));
  });

  it('should get annotator config without resource of type resource', async() => {
    const httpPostSpy = jest.spyOn(HttpClient.prototype, 'post');
    httpPostSpy.mockReturnValue(of(
      /* eslint-disable camelcase */
      {
        annotator_type: 'gene_set_annotator',
        input_gene_list: {
          field_type: 'string',
        },
        input_annotatable: {
          field_type: 'string'
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
      '',
      [
        new Resource('input_gene_list', 'string', '', '', null),
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

  it('should get atrtibutes', async() => {
    const httpPostSpy = jest.spyOn(HttpClient.prototype, 'post');
    httpPostSpy.mockReturnValue(of([
      {
        name: 'fitcons_i6_merged',
        source: 'fc_i6_score',
        type: 'float',
        internal: false,
        default: true
      }
    ]));

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
    expect(res).toStrictEqual([
      new AnnotatorAttribute('fitcons_i6_merged', 'float', 'fc_i6_score', false, true)
    ]);
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
      'liftover_annotator',
      {
        chain: 'liftover/T2T_to_hg38',
        // eslint-disable-next-line camelcase
        source_genome: 'hg38/genomes/GRCh38-hg38',
        // eslint-disable-next-line camelcase
        target_genome: 'hg19/genomes/GATK_ResourceBundle_5777_b37_phiX174'
      },
      [new AnnotatorAttribute('liftover_annotatable', 'annotatable', 'liftover_annotatable', true, true)]
    );

    expect(httpPostSpy).toHaveBeenCalledWith(
      '//localhost:8000/api/editor/annotator_yaml',
      {
        attributes: [
          // eslint-disable-next-line @stylistic/max-len
          {name: 'liftover_annotatable', type: 'annotatable', source: 'liftover_annotatable', internal: true, selectedBydefault: true }
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
});
