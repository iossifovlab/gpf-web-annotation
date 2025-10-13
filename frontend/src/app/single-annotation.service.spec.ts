import { TestBed } from '@angular/core/testing';
import { SingleAnnotationService } from './single-annotation.service';
import { HttpClient, provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { lastValueFrom, of, take } from 'rxjs';
import {
  Annotator,
  AnnotatorDetails,
  Attribute,
  SingleAnnotationReport,
  Variant,
  Result,
  NumberHistogram,
  CategoricalHistogram
} from './single-annotation';
import { cloneDeep } from 'lodash';

const mockNumberHistogram = {
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
};

const mockCategoricalHistogram = {
  config: {
    type: 'categorical',
    // eslint-disable-next-line camelcase
    value_order: [
      '1',
      '2',
      '3',
      '4',
      '5',
      '6',
      '7',
      '8'
    ],
    // eslint-disable-next-line camelcase
    y_log_scale: false,
    // eslint-disable-next-line camelcase
    label_rotation: 90
  },
  values: {
    1: 233,
    2: 706,
    3: 143,
    4: 110,
    5: 20,
    6: 14,
    7: 1,
    8: 300,
  },
  // eslint-disable-next-line camelcase
  small_values_desc: 'weak evidence for association with ASD',
  // eslint-disable-next-line camelcase
  large_values_desc: 'strong evidence for association with ASD'
};

const mockResponse = {
  variant: {
    chromosome: 'chr14',
    position: 204000100,
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
          source: 'AF',
          result: {
            value: '',
            histogram: 'histograms/score?test=1',
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
    const options = { headers: { 'X-CSRFToken': '' }, withCredentials: true };

    service.getReport(new Variant('chr14', 204000100, 'A', 'AA', null), 'genome');
    expect(httpGetSpy).toHaveBeenCalledWith(
      '//localhost:8000/api/single_annotate',
      { variant: { chrom: 'chr14', pos: 204000100, ref: 'A', alt: 'AA'}, genome: 'genome' },
      options
    );
  });

  it('should get single annotation report', async() => {
    const mockObject = new SingleAnnotationReport(
      new Variant('chr14', 204000100, 'A', 'AA', 'ins'),
      [
        new Annotator(
          new AnnotatorDetails('allele_score', 'description', 'link'),
          [
            new Attribute(
              'cadd_raw',
              // eslint-disable-next-line @stylistic/max-len
              'cadd_raw - CADD raw score for functional prediction of a SNP. The larger the score \nthe more likely the SNP has damaging effect\n',
              'AF',
              {
                value: '',
                histogramLink: 'histograms/score?test=1',
              } as Result,
              '',
            ),
          ]
        ),
      ]
    );
    const httpPostSpy = jest.spyOn(HttpClient.prototype, 'post');
    httpPostSpy.mockReturnValue(of(mockResponse));

    const getReport = service.getReport(new Variant('chr14', 204000100, 'A', 'AA', null), 'genome');

    const res = await lastValueFrom(getReport.pipe(take(1)));
    expect(res).toStrictEqual(mockObject);
  });

  it('should set score to undefined when score data from query response is invalid', async() => {
    const mockObject = new SingleAnnotationReport(
      new Variant('chr14', 204000100, 'A', 'AA', 'ins'),
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

    const getReport = service.getReport(new Variant('chr14', 204000100, 'A', 'AA', null), 'genome');

    const res = await lastValueFrom(getReport.pipe(take(1)));
    expect(res).toStrictEqual(mockObject);
  });

  it('should set array of scores to undefined when scores data from query response are invalid', async() => {
    const mockObject = new SingleAnnotationReport(
      new Variant('chr14', 204000100, 'A', 'AA', 'ins'),
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

    const getReport = service.getReport(new Variant('chr14', 204000100, 'A', 'AA', null), 'genome');

    const res = await lastValueFrom(getReport.pipe(take(1)));
    expect(res).toStrictEqual(mockObject);
  });

  it('should set annotator to undefined when annotator data from query response is invalid', async() => {
    const mockObject = new SingleAnnotationReport(
      new Variant('chr14', 204000100, 'A', 'AA', 'ins'),
      [undefined]
    );

    const mockResponseInvalidAnnotator = cloneDeep(mockResponse);
    mockResponseInvalidAnnotator.annotators[0] = null;

    const httpPostSpy = jest.spyOn(HttpClient.prototype, 'post');
    httpPostSpy.mockReturnValue(of(mockResponseInvalidAnnotator));

    const getReport = service.getReport(new Variant('chr14', 204000100, 'A', 'AA', null), 'genome');

    const res = await lastValueFrom(getReport.pipe(take(1)));
    expect(res).toStrictEqual(mockObject);
  });

  it('should set array of annotators to undefined when annotators from query response are invalid', async() => {
    const mockObject = new SingleAnnotationReport(
      new Variant('chr14', 204000100, 'A', 'AA', 'ins'),
      undefined
    );

    const mockResponseInvalidAnnotators = cloneDeep(mockResponse);
    mockResponseInvalidAnnotators.annotators = null;

    const httpPostSpy = jest.spyOn(HttpClient.prototype, 'post');
    httpPostSpy.mockReturnValue(of(mockResponseInvalidAnnotators));

    const getReport = service.getReport(new Variant('chr14', 204000100, 'A', 'AA', null), 'genome');

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
              'AF',
              {
                value: '',
                histogramLink: 'histograms/score?test=1',
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

    const getReport = service.getReport(new Variant('chr14', 204000100, 'A', 'AA', null), 'genome');

    const res = await lastValueFrom(getReport.pipe(take(1)));
    expect(res).toStrictEqual(mockObject);
  });

  it('should set report to undefined when report data from query response is invalid', async() => {
    const httpPostSpy = jest.spyOn(HttpClient.prototype, 'post');
    httpPostSpy.mockReturnValue(of(null));

    const getReport = service.getReport(new Variant('chr14', 204000100, 'A', 'AA', null), 'genome');

    const res = await lastValueFrom(getReport.pipe(take(1)));
    expect(res).toBeUndefined();
  });

  it('should get number histogram of a score', async() => {
    const httpGetSpy = jest.spyOn(HttpClient.prototype, 'get');
    httpGetSpy.mockReturnValue(of(mockNumberHistogram));

    const histogram = new NumberHistogram(
      [1, 2, 3],
      [1, 2, 3],
      'small values',
      'large values',
      -8,
      36,
      false,
      true
    );

    const histResponse = service.getHistogram('histograms/score?test=1');

    const res = await lastValueFrom(histResponse.pipe(take(1)));
    expect(res).toStrictEqual(histogram);
  });

  it('should get categorical histogram of a score', async() => {
    const httpGetSpy = jest.spyOn(HttpClient.prototype, 'get');
    httpGetSpy.mockReturnValue(of(mockCategoricalHistogram));

    const histogram = new CategoricalHistogram(
      [
        { name: '1', value: 233 },
        { name: '2', value: 706 },
        { name: '3', value: 143 },
        { name: '4', value: 110 },
        { name: '5', value: 20 },
        { name: '6', value: 14 },
        { name: '7', value: 1 },
        { name: '8', value: 300 },
      ],
      ['1', '2', '3', '4', '5', '6', '7', '8'],
      'weak evidence for association with ASD',
      'strong evidence for association with ASD',
      false,
      90,
      null,
      null
    );

    const histResponse = service.getHistogram('histograms/score?test=1');

    const res = await lastValueFrom(histResponse.pipe(take(1)));
    expect(res).toStrictEqual(histogram);
  });

  it('should check headers when getting histogram', () => {
    const httpGetSpy = jest.spyOn(HttpClient.prototype, 'get');
    httpGetSpy.mockReturnValue(of(mockNumberHistogram));

    service.getHistogram('histograms/score?test=1');

    expect(httpGetSpy).toHaveBeenCalledWith(
      '//localhost:8000/api/histograms/score?test=1',
      { headers: { 'X-CSRFToken': '' }, withCredentials: true }
    );
  });
});
