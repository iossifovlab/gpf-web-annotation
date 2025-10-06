import { TestBed } from '@angular/core/testing';
import { SingleAnnotationService } from './single-annotation.service';
import { HttpClient, provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { lastValueFrom, of, take } from 'rxjs';
import {
  Annotator,
  AnnotatorDetails,
  NumberHistogram,
  Attribute,
  SingleAnnotationReport,
  Variant,
  Result
} from './single-annotation';
import { cloneDeep } from 'lodash';

const mockResponse = {
  variant: {
    chromosome: 'chr14',
    position: '204 000 100',
    reference: 'A',
    alternative: 'AA',
    // eslint-disable-next-line camelcase
    variant_type: 'ins',
  },
  annotators: [
    {
      // eslint-disable-next-line camelcase
      details: {
        name: 'allele_score',
        description: 'description',
        // eslint-disable-next-line camelcase
        resource_id: 'link',
      },
      attributes: [
        {
          name: 'cadd_raw',
          // eslint-disable-next-line @stylistic/max-len
          description: 'cadd_raw - CADD raw score for functional prediction of a SNP. The larger the score \nthe more likely the SNP has damaging effect\n',
          result: {
            value: '',
            histogram: {
              config: {
                type: 'number',
                // eslint-disable-next-line camelcase
                view_range: {
                  min: -8,
                  max: 36
                },
                // eslint-disable-next-line camelcase
                number_of_bins: 100,
                // eslint-disable-next-line camelcase
                x_log_scale: false,
                // eslint-disable-next-line camelcase
                y_log_scale: true,
                // eslint-disable-next-line camelcase
                x_min_log: null
              },
              bins: [1, 2, 3],
              bars: [1, 2, 3],
              // eslint-disable-next-line camelcase
              out_of_range_bins: [
                0,
                0
              ],
              // eslint-disable-next-line camelcase
              min_value: -6,
              // eslint-disable-next-line camelcase
              max_value: 18,
              // eslint-disable-next-line camelcase
              small_values_desc: 'small values',
              // eslint-disable-next-line camelcase
              large_values_desc: 'large values'
            }
          },
          help: '',
        },
      ],
    },
  ],
};

describe('SingleAnnotationService', () => {
  let service: SingleAnnotationService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        SingleAnnotationService,
        provideHttpClient(),
        provideHttpClientTesting(),
      ]
    });

    service = TestBed.inject(SingleAnnotationService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should check query parameters when requesting annotation report', () => {
    const httpGetSpy = jest.spyOn(HttpClient.prototype, 'post');
    const options = {
      withCredentials: true
    };

    service.getReport(new Variant('chr14', '204000100', 'A', 'AA', null), 'genome');
    expect(httpGetSpy).toHaveBeenCalledWith(
      '//localhost:8000/api/single-annotation',
      { variant: { chrom: 'chr14', pos: '204000100', ref: 'A', alt: 'AA'}, genome: 'genome' },
      options
    );
  });

  it('should get single annotation report', async() => {
    const mockObject = new SingleAnnotationReport(
      new Variant('chr14', '204 000 100', 'A', 'AA', 'ins'),
      [
        new Annotator(
          new AnnotatorDetails('allele_score', 'description', 'link'),
          [
            new Attribute(
              'cadd_raw',
              // eslint-disable-next-line @stylistic/max-len
              'cadd_raw - CADD raw score for functional prediction of a SNP. The larger the score \nthe more likely the SNP has damaging effect\n',
              {
                value: '',
                histogram: new NumberHistogram(
                  [1, 2, 3],
                  [1, 2, 3],
                  'small values',
                  'large values',
                  -8,
                  36,
                  false,
                  true,
                ),
              } as Result,
              '',
            ),
          ]
        ),
      ]
    );
    const httpPostSpy = jest.spyOn(HttpClient.prototype, 'post');
    httpPostSpy.mockReturnValue(of(mockResponse));

    const getReport = service.getReport(new Variant('chr14', '204000100', 'A', 'AA', null), 'genome');

    const res = await lastValueFrom(getReport.pipe(take(1)));
    expect(res).toStrictEqual(mockObject);
  });

  it('should set histogram of a score to undefined when histogram data from query response is invalid', async() => {
    const mockObject = new SingleAnnotationReport(
      new Variant('chr14', '204 000 100', 'A', 'AA', 'ins'),
      [
        new Annotator(
          new AnnotatorDetails('allele_score', 'description', 'link'),
          [
            new Attribute(
              'cadd_raw',
              // eslint-disable-next-line @stylistic/max-len
              'cadd_raw - CADD raw score for functional prediction of a SNP. The larger the score \nthe more likely the SNP has damaging effect\n',
              { value: '', histogram: undefined },
              '',
            ),
          ]
        ),
      ]
    );

    const mockResponseInvalidHistogram = cloneDeep(mockResponse);
    mockResponseInvalidHistogram.annotators[0].attributes[0].result.histogram = null;

    const httpPostSpy = jest.spyOn(HttpClient.prototype, 'post');
    httpPostSpy.mockReturnValue(of(mockResponseInvalidHistogram));

    const getReport = service.getReport(new Variant('chr14', '204000100', 'A', 'AA', null), 'genome');

    const res = await lastValueFrom(getReport.pipe(take(1)));
    expect(res).toStrictEqual(mockObject);
  });

  it('should set score to undefined when score data from query response is invalid', async() => {
    const mockObject = new SingleAnnotationReport(
      new Variant('chr14', '204 000 100', 'A', 'AA', 'ins'),
      [
        new Annotator(
          new AnnotatorDetails('allele_score', 'description', 'link'),
          [undefined]
        ),
      ]
    );

    const mockResponseInvalidScore = cloneDeep(mockResponse);
    mockResponseInvalidScore.annotators[0].attributes[0] = null;

    const httpPostSpy = jest.spyOn(HttpClient.prototype, 'post');
    httpPostSpy.mockReturnValue(of(mockResponseInvalidScore));

    const getReport = service.getReport(new Variant('chr14', '204000100', 'A', 'AA', null), 'genome');

    const res = await lastValueFrom(getReport.pipe(take(1)));
    expect(res).toStrictEqual(mockObject);
  });

  it('should set array of scores to undefined when scores data from query response are invalid', async() => {
    const mockObject = new SingleAnnotationReport(
      new Variant('chr14', '204 000 100', 'A', 'AA', 'ins'),
      [
        new Annotator(
          new AnnotatorDetails('allele_score', 'description', 'link'),
          undefined
        ),
      ]
    );

    const mockResponseInvalidScores = cloneDeep(mockResponse);
    mockResponseInvalidScores.annotators[0].attributes = null;

    const httpPostSpy = jest.spyOn(HttpClient.prototype, 'post');
    httpPostSpy.mockReturnValue(of(mockResponseInvalidScores));

    const getReport = service.getReport(new Variant('chr14', '204000100', 'A', 'AA', null), 'genome');

    const res = await lastValueFrom(getReport.pipe(take(1)));
    expect(res).toStrictEqual(mockObject);
  });

  it('should set annotator to undefined when annotator data from query response is invalid', async() => {
    const mockObject = new SingleAnnotationReport(
      new Variant('chr14', '204 000 100', 'A', 'AA', 'ins'),
      [undefined]
    );

    const mockResponseInvalidAnnotator = cloneDeep(mockResponse);
    mockResponseInvalidAnnotator.annotators[0] = null;

    const httpPostSpy = jest.spyOn(HttpClient.prototype, 'post');
    httpPostSpy.mockReturnValue(of(mockResponseInvalidAnnotator));

    const getReport = service.getReport(new Variant('chr14', '204000100', 'A', 'AA', null), 'genome');

    const res = await lastValueFrom(getReport.pipe(take(1)));
    expect(res).toStrictEqual(mockObject);
  });

  it('should set array of annotators to undefined when annotators from query response are invalid', async() => {
    const mockObject = new SingleAnnotationReport(
      new Variant('chr14', '204 000 100', 'A', 'AA', 'ins'),
      undefined
    );

    const mockResponseInvalidAnnotators = cloneDeep(mockResponse);
    mockResponseInvalidAnnotators.annotators = null;

    const httpPostSpy = jest.spyOn(HttpClient.prototype, 'post');
    httpPostSpy.mockReturnValue(of(mockResponseInvalidAnnotators));

    const getReport = service.getReport(new Variant('chr14', '204000100', 'A', 'AA', null), 'genome');

    const res = await lastValueFrom(getReport.pipe(take(1)));
    expect(res).toStrictEqual(mockObject);
  });

  it('should set variant to undefined when variant data from query response is invalid', async() => {
    const mockObject = new SingleAnnotationReport(
      undefined,
      [
        new Annotator(
          new AnnotatorDetails('allele_score', 'description', 'link'),
          [
            new Attribute(
              'cadd_raw',
              // eslint-disable-next-line @stylistic/max-len
              'cadd_raw - CADD raw score for functional prediction of a SNP. The larger the score \nthe more likely the SNP has damaging effect\n',
              {
                value: '',
                histogram: new NumberHistogram(
                  [1, 2, 3],
                  [1, 2, 3],
                  'small values',
                  'large values',
                  -8,
                  36,
                  false,
                  true,
                )
              },
              '',
            ),
          ]
        ),
      ]
    );

    const mockResponseInvalidVariant = cloneDeep(mockResponse);
    mockResponseInvalidVariant.variant = null;

    const httpPostSpy = jest.spyOn(HttpClient.prototype, 'post');
    httpPostSpy.mockReturnValue(of(mockResponseInvalidVariant));

    const getReport = service.getReport(new Variant('chr14', '204000100', 'A', 'AA', null), 'genome');

    const res = await lastValueFrom(getReport.pipe(take(1)));
    expect(res).toStrictEqual(mockObject);
  });

  it('should set report to undefined when report data from query response is invalid', async() => {
    const httpPostSpy = jest.spyOn(HttpClient.prototype, 'post');
    httpPostSpy.mockReturnValue(of(null));

    const getReport = service.getReport(new Variant('chr14', '204000100', 'A', 'AA', null), 'genome');

    const res = await lastValueFrom(getReport.pipe(take(1)));
    expect(res).toBeUndefined();
  });
});
