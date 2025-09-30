import { TestBed } from '@angular/core/testing';
import { SingleAnnotationService } from './single-annotation.service';
import { HttpClient, provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { lastValueFrom, of, take } from 'rxjs';
import { Annotator, AnnotatorType, NumberHistogram, Score, SingleAnnotationReport, Variant } from './single-annotation';
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
      annotator_type: {
        name: 'allele_score',
        description: 'description',
        resourceLink: 'link',
      },
      scores: [
        {
          name: 'cadd_raw',
          // eslint-disable-next-line @stylistic/max-len
          description: 'cadd_raw - CADD raw score for functional prediction of a SNP. The larger the score \nthe more likely the SNP has damaging effect\n',
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

    service.getReport('variant', 'genome');
    expect(httpGetSpy).toHaveBeenCalledWith(
      '//localhost:8000/api/single-annotation',
      { variant: 'variant', genome: 'genome' },
      options
    );
  });

  it('should get single annotation report', async() => {
    const mockObject = new SingleAnnotationReport(
      new Variant('chr14', '204 000 100', 'A', 'AA', 'ins'),
      [
        new Annotator(
          { name: 'allele_score', description: 'description', resourceLink: 'link' } as AnnotatorType,
          [
            new Score(
              'cadd_raw',
              // eslint-disable-next-line @stylistic/max-len
              'cadd_raw - CADD raw score for functional prediction of a SNP. The larger the score \nthe more likely the SNP has damaging effect\n',
              new NumberHistogram(
                [1, 2, 3],
                [1, 2, 3],
                'small values',
                'large values',
                -8,
                36,
                false,
                true,
              ),
              '',
            ),
          ]
        ),
      ]
    );
    const httpPostSpy = jest.spyOn(HttpClient.prototype, 'post');
    httpPostSpy.mockReturnValue(of(mockResponse));

    const getReport = service.getReport('variant', 'genome');

    const res = await lastValueFrom(getReport.pipe(take(1)));
    expect(res).toStrictEqual(mockObject);
  });

  it('should set histogram of a score to undefined when histogram data from query response is invalid', async() => {
    const mockObject = new SingleAnnotationReport(
      new Variant('chr14', '204 000 100', 'A', 'AA', 'ins'),
      [
        new Annotator(
          { name: 'allele_score', description: 'description', resourceLink: 'link' } as AnnotatorType,
          [
            new Score(
              'cadd_raw',
              // eslint-disable-next-line @stylistic/max-len
              'cadd_raw - CADD raw score for functional prediction of a SNP. The larger the score \nthe more likely the SNP has damaging effect\n',
              undefined,
              '',
            ),
          ]
        ),
      ]
    );

    const mockResponseInvalidHistogram = cloneDeep(mockResponse);
    mockResponseInvalidHistogram.annotators[0].scores[0].histogram = null;

    const httpPostSpy = jest.spyOn(HttpClient.prototype, 'post');
    httpPostSpy.mockReturnValue(of(mockResponseInvalidHistogram));

    const getReport = service.getReport('variant', 'genome');

    const res = await lastValueFrom(getReport.pipe(take(1)));
    expect(res).toStrictEqual(mockObject);
  });

  it('should set score to undefined when score data from query response is invalid', async() => {
    const mockObject = new SingleAnnotationReport(
      new Variant('chr14', '204 000 100', 'A', 'AA', 'ins'),
      [
        new Annotator(
          { name: 'allele_score', description: 'description', resourceLink: 'link' } as AnnotatorType,
          [undefined]
        ),
      ]
    );

    const mockResponseInvalidScore = cloneDeep(mockResponse);
    mockResponseInvalidScore.annotators[0].scores[0] = null;

    const httpPostSpy = jest.spyOn(HttpClient.prototype, 'post');
    httpPostSpy.mockReturnValue(of(mockResponseInvalidScore));

    const getReport = service.getReport('variant', 'genome');

    const res = await lastValueFrom(getReport.pipe(take(1)));
    expect(res).toStrictEqual(mockObject);
  });

  it('should set array of scores to undefined when scores data from query response are invalid', async() => {
    const mockObject = new SingleAnnotationReport(
      new Variant('chr14', '204 000 100', 'A', 'AA', 'ins'),
      [
        new Annotator(
          { name: 'allele_score', description: 'description', resourceLink: 'link' } as AnnotatorType,
          undefined
        ),
      ]
    );

    const mockResponseInvalidScores = cloneDeep(mockResponse);
    mockResponseInvalidScores.annotators[0].scores = null;

    const httpPostSpy = jest.spyOn(HttpClient.prototype, 'post');
    httpPostSpy.mockReturnValue(of(mockResponseInvalidScores));

    const getReport = service.getReport('variant', 'genome');

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

    const getReport = service.getReport('variant', 'genome');

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

    const getReport = service.getReport('variant', 'genome');

    const res = await lastValueFrom(getReport.pipe(take(1)));
    expect(res).toStrictEqual(mockObject);
  });

  it('should set variant to undefined when variant data from query response is invalid', async() => {
    const mockObject = new SingleAnnotationReport(
      undefined,
      [
        new Annotator(
          { name: 'allele_score', description: 'description', resourceLink: 'link' } as AnnotatorType,
          [
            new Score(
              'cadd_raw',
              // eslint-disable-next-line @stylistic/max-len
              'cadd_raw - CADD raw score for functional prediction of a SNP. The larger the score \nthe more likely the SNP has damaging effect\n',
              new NumberHistogram(
                [1, 2, 3],
                [1, 2, 3],
                'small values',
                'large values',
                -8,
                36,
                false,
                true,
              ),
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

    const getReport = service.getReport('variant', 'genome');

    const res = await lastValueFrom(getReport.pipe(take(1)));
    expect(res).toStrictEqual(mockObject);
  });

  it('should set report to undefined when report data from query response is invalid', async() => {
    const httpPostSpy = jest.spyOn(HttpClient.prototype, 'post');
    httpPostSpy.mockReturnValue(of(null));

    const getReport = service.getReport('variant', 'genome');

    const res = await lastValueFrom(getReport.pipe(take(1)));
    expect(res).toBeUndefined();
  });
});
