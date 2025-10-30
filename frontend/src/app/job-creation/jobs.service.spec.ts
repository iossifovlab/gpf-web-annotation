import { TestBed } from '@angular/core/testing';
import { HttpClient, HttpErrorResponse, HttpResponse, provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { lastValueFrom, of, take, throwError } from 'rxjs';
import { JobsService } from './jobs.service';
import { FileContent, getStatusClassName, Job } from './jobs';
import { Pipeline } from './pipelines';

const jobsMockJson = [
  { id: 1, created: '1.10.2025', owner: 'test@email.com', status: 3, duration: 4.7 },
  { id: 2, created: '1.10.2025', owner: 'test@email.com', status: 5, duration: 2.5 },
  { id: 3, created: '1.10.2025', owner: 'test@email.com', status: 4, duration: 2.3 },
  { id: 4, created: '1.10.2025', owner: 'test@email.com', status: 2, duration: 1.9 },
  { id: 5, created: '1.10.2025', owner: 'test@email.com', status: 1, duration: 5.2 },
];

describe('JobsService', () => {
  let service: JobsService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        JobsService,
        provideHttpClient(),
        provideHttpClientTesting()
      ]
    });

    service = TestBed.inject(JobsService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should create job with config written by user', async() => {
    const httpPostSpy = jest.spyOn(HttpClient.prototype, 'post');
    httpPostSpy.mockReturnValue(of(null));

    const mockInputFile = new File(['mockData'], 'mockInput.vcf');

    const postResult = service.createVcfJob(mockInputFile, null, 'mockConfigData', 'hg38');

    const res = await lastValueFrom(postResult.pipe(take(1)));
    expect(res).toBeNull();
  });

  it('should create job with config chosen from pipeline list by user', async() => {
    const httpPostSpy = jest.spyOn(HttpClient.prototype, 'post');
    httpPostSpy.mockReturnValue(of(null));

    const mockInputFile = new File(['mockData'], 'mockInput.vcf');

    const postResult = service.createVcfJob(mockInputFile, 'autism', null, null);

    const res = await lastValueFrom(postResult.pipe(take(1)));
    expect(res).toBeNull();
  });

  it('should create job with non vcf file uploaded', () => {
    const httpPostSpy = jest.spyOn(HttpClient.prototype, 'post');
    httpPostSpy.mockReturnValue(of({}));

    const mockInputFile = new File(['mockData'], 'mockInput.tsv');

    const formData = new FormData();
    formData.append('data', mockInputFile);
    formData.append('genome', 'hg38');
    formData.append('separator', '\t');
    formData.append('pipeline', 'autism');

    const options = {
      headers: {
        'X-CSRFToken': ''
      },
      withCredentials: true
    };

    service.createNonVcfJob(mockInputFile, 'autism', null, 'hg38', '\t');

    expect(httpPostSpy).toHaveBeenCalledWith(
      '//localhost:8000/api/jobs/annotate_columns',
      formData,
      options
    );
  });

  it('should catch error 403 for daily quota limit when creating job', async() => {
    const httpError = new HttpErrorResponse({status: 403, error: {reason: 'Daily quota limit reached!'}});
    const httpPostSpy = jest.spyOn(HttpClient.prototype, 'post');
    httpPostSpy.mockReturnValue(throwError(() => httpError));

    const mockInputFile = new File(['mockData'], 'mockInput.vcf');

    const postResult = service.createVcfJob(mockInputFile, 'autism', null, null);

    await expect(() => lastValueFrom(postResult.pipe(take(1))))
      .rejects.toThrow('Daily quota limit reached!');
  });

  it('should catch error 413 for upload limit when creating job', async() => {
    const httpError = new HttpErrorResponse({status: 413});
    const httpPostSpy = jest.spyOn(HttpClient.prototype, 'post');
    httpPostSpy.mockReturnValue(throwError(() => httpError));

    const mockInputFile = new File(['mockData'], 'mockInput.vcf');

    const postResult = service.createVcfJob(mockInputFile, 'autism', null, null);

    await expect(() => lastValueFrom(postResult.pipe(take(1))))
      .rejects.toThrow('Upload limit reached!');
  });

  it('should catch error 400 for invalid pipeline configuration file when creating job', async() => {
    const httpError = new HttpErrorResponse({status: 400, error: {reason: 'Invalid pipeline configuration file!'}});
    const httpPostSpy = jest.spyOn(HttpClient.prototype, 'post');
    httpPostSpy.mockReturnValue(throwError(() => httpError));

    const mockInputFile = new File(['mockData'], 'mockInput.vcf');

    const postResult = service.createVcfJob(mockInputFile, 'autism', null, null);

    await expect(() => lastValueFrom(postResult.pipe(take(1))))
      .rejects.toThrow('Invalid pipeline configuration file!');
  });

  it('should throw default message for other error cases when creating job', async() => {
    const httpError = new HttpErrorResponse({status: 422});
    const httpPostSpy = jest.spyOn(HttpClient.prototype, 'post');
    httpPostSpy.mockReturnValue(throwError(() => httpError));

    const mockInputFile = new File(['mockData'], 'mockInput.vcf');

    const postResult = service.createVcfJob(mockInputFile, 'autism', null, null);

    await expect(() => lastValueFrom(postResult.pipe(take(1))))
      .rejects.toThrow('Error occurred!');
  });

  it('should check if create query has correct parameters when config is written by user', () => {
    const httpPostSpy = jest.spyOn(HttpClient.prototype, 'post');
    httpPostSpy.mockReturnValue(of(new HttpResponse({status: 204})));

    const mockInputFile = new File(['mockData'], 'mockInput.vcf');
    const mockConfigCntent = 'mockConfigCntent';
    const mockConfigFile = new File([mockConfigCntent], 'mockConfig.vcf');

    const formData = new FormData();
    formData.append('data', mockInputFile, 'mockInput.vcf');
    formData.append('genome', 'hg38');
    formData.append('config', mockConfigFile);

    const options = {
      headers: {
        'X-CSRFToken': ''
      },
      withCredentials: true
    };

    service.createVcfJob(mockInputFile, null, mockConfigCntent, 'hg38');

    expect(httpPostSpy).toHaveBeenCalledWith(
      '//localhost:8000/api/jobs/annotate_vcf',
      formData,
      options
    );
  });

  it('should check if create query has correct parameters when config is chosen by user', () => {
    const httpPostSpy = jest.spyOn(HttpClient.prototype, 'post');
    httpPostSpy.mockReturnValue(of(new HttpResponse({status: 204})));

    const mockInputFile = new File(['mockData'], 'mockInput.vcf');

    const formData = new FormData();
    formData.append('data', mockInputFile, 'mockInput.vcf');
    formData.append('genome', 'hg38');
    formData.append('pipeline', 'autism');

    const options = {
      headers: {
        'X-CSRFToken': ''
      },
      withCredentials: true
    };

    service.createVcfJob(mockInputFile, 'autism', null, 'hg38');

    expect(httpPostSpy).toHaveBeenCalledWith(
      '//localhost:8000/api/jobs/annotate_vcf',
      formData,
      options
    );
  });

  it('should check if csrf token is get from cookies and sent in create query', () => {
    const httpPostSpy = jest.spyOn(HttpClient.prototype, 'post');
    httpPostSpy.mockReturnValue(of(new HttpResponse({status: 204})));

    const mockInputFile = new File(['mockData'], 'mockInput.vcf');
    const mockConfigCntent = 'mockConfigContent';
    const mockConfigFile = new File([mockConfigCntent], 'mockConfig.vcf');

    const formData = new FormData();
    formData.append('data', mockInputFile, 'mockInput.vcf');
    formData.append('genome', 'hg38');
    formData.append('config', mockConfigFile);

    const mockCookie = 'csrftoken=EYZbFmv1i1Ie7cmT3OFHgxdv3kOR7rIt';
    document.cookie = mockCookie;

    const options = {
      headers: {
        'X-CSRFToken': 'EYZbFmv1i1Ie7cmT3OFHgxdv3kOR7rIt'
      },
      withCredentials: true
    };

    service.createVcfJob(mockInputFile, null, mockConfigCntent, 'hg38');
    expect(httpPostSpy).toHaveBeenCalledWith(
      '//localhost:8000/api/jobs/annotate_vcf',
      formData,
      options
    );
  });

  it('should check parameters of get jobs query', () => {
    const httpGetSpy = jest.spyOn(HttpClient.prototype, 'get');

    const mockCookie = 'csrftoken=EYZbFmv1i1Ie7cmT3OFHgxdv3kOR7rIt';
    document.cookie = mockCookie;

    const options = {
      headers: {
        'X-CSRFToken': 'EYZbFmv1i1Ie7cmT3OFHgxdv3kOR7rIt'
      },
      withCredentials: true
    };

    service.getJobs();
    expect(httpGetSpy).toHaveBeenCalledWith(
      '//localhost:8000/api/jobs',
      options
    );
  });

  it('should get users jobs and create list with job objects from response', async() => {
    const httpGetSpy = jest.spyOn(HttpClient.prototype, 'get');
    httpGetSpy.mockReturnValue(of(jobsMockJson));

    const jobsMockResult = [
      new Job(1, new Date('1.10.2025'), 'test@email.com', 'in process', 4.7),
      new Job(2, new Date('1.10.2025'), 'test@email.com', 'failed', 2.5),
      new Job(3, new Date('1.10.2025'), 'test@email.com', 'success', 2.3),
      new Job(4, new Date('1.10.2025'), 'test@email.com', 'waiting', 1.9),
      new Job(5, new Date('1.10.2025'), 'test@email.com', 'specifying', 5.2),
    ];

    const getResponse = service.getJobs();

    const res = await lastValueFrom(getResponse.pipe(take(1)));
    expect(res).toStrictEqual(jobsMockResult);
  });

  it('should return undefined when converting invalid response into array of jobs', async() => {
    const httpGetSpy = jest.spyOn(HttpClient.prototype, 'get');
    httpGetSpy.mockReturnValue(of(null));

    const getResponse = service.getJobs();

    const res = await lastValueFrom(getResponse.pipe(take(1)));
    expect(res).toBeUndefined();
  });

  it('should return undefined when converting array with invalid data into array of jobs', async() => {
    const httpGetSpy = jest.spyOn(HttpClient.prototype, 'get');
    httpGetSpy.mockReturnValue(of([null]));

    const getResponse = service.getJobs();

    const res = await lastValueFrom(getResponse.pipe(take(1)));
    expect(res).toStrictEqual([undefined]);
  });

  it('should get details of a job', async() => {
    const httpGetSpy = jest.spyOn(HttpClient.prototype, 'get');
    httpGetSpy.mockReturnValue(of(
      {
        id: 16,
        created: '2025-08-26',
        status: 2,
        owner: 'register@email.com',
        duration: 3.3
      }
    ));

    const job = new Job(16, new Date('2025-08-26'), 'register@email.com', 'waiting', 3.3);

    const getResponse = service.getJobDetails(16);

    const res = await lastValueFrom(getResponse.pipe(take(1)));
    expect(res).toStrictEqual(job);
  });


  it('should create annotated file download link', () => {
    const url = service.getDownloadJobResultLink(10);
    expect(url).toBe('//localhost:8000/api/jobs/10/file/result');
  });

  it('should create config file download link', () => {
    const url = service.getJobConfigLink(10);
    expect(url).toBe('//localhost:8000/api/jobs/10/file/config');
  });

  it('should create input file download link', () => {
    const url = service.getJobInputDownloadLink(10);
    expect(url).toBe('//localhost:8000/api/jobs/10/file/input');
  });

  it('should get correct class name for waiting status', () => {
    expect(getStatusClassName('waiting')).toBe('waiting-status');
  });

  it('should get correct class name for in progress status', () => {
    expect(getStatusClassName('in process')).toBe('in-progress-status');
  });

  it('should get correct class name for success status', () => {
    expect(getStatusClassName('success')).toBe('success-status');
  });

  it('should get correct class name for fail status', () => {
    expect(getStatusClassName('failed')).toBe('fail-status');
  });

  it('should return empty string as class name for invalid status', () => {
    expect(getStatusClassName('nonexisting')).toBe('');
  });

  it('should get pipeline list', async() => {
    const httpGetSpy = jest.spyOn(HttpClient.prototype, 'get');
    httpGetSpy.mockReturnValue(of([
      { id: 'pipeline1', content: '' },
      { id: 'pipeline2', content: '' },
      { id: 'pipeline3', content: '' },
    ]));

    const getResponse = service.getAnnotationPipelines();

    expect(httpGetSpy).toHaveBeenCalledWith(
      '//localhost:8000/api/pipelines',
      { withCredentials: true }
    );
    const res = await lastValueFrom(getResponse.pipe(take(1)));
    expect(res).toStrictEqual([
      new Pipeline('pipeline1', ''),
      new Pipeline('pipeline2', ''),
      new Pipeline('pipeline3', ''),
    ]);
  });

  it('should return undefined if json is invalid when getting pipelines', async() => {
    const httpGetSpy = jest.spyOn(HttpClient.prototype, 'get');
    httpGetSpy.mockReturnValue(of(null));

    const getResponse = service.getAnnotationPipelines();

    expect(httpGetSpy).toHaveBeenCalledWith(
      '//localhost:8000/api/pipelines',
      { withCredentials: true }
    );
    const res = await lastValueFrom(getResponse.pipe(take(1)));
    expect(res).toBeUndefined();
  });

  it('should return undefined for each invalid pipeline from response array', async() => {
    const httpGetSpy = jest.spyOn(HttpClient.prototype, 'get');
    httpGetSpy.mockReturnValue(of([
      { id: 'pipeline1', content: '' },
      null
    ]));

    const getResponse = service.getAnnotationPipelines();

    expect(httpGetSpy).toHaveBeenCalledWith(
      '//localhost:8000/api/pipelines',
      { withCredentials: true }
    );
    const res = await lastValueFrom(getResponse.pipe(take(1)));
    expect(res).toStrictEqual([
      new Pipeline('pipeline1', ''),
      undefined
    ]);
  });

  it('should delete job', () => {
    const httpDeleteSpy = jest.spyOn(HttpClient.prototype, 'delete');
    httpDeleteSpy.mockReturnValue(of({}));

    const mockCookie = 'csrftoken=mockToken';
    document.cookie = mockCookie;

    service.deleteJob(10);
    const options = { headers: {'X-CSRFToken': 'mockToken' }, withCredentials: true };
    expect(httpDeleteSpy).toHaveBeenCalledWith(
      '//localhost:8000/api/jobs/10',
      options
    );
  });

  it('should send file and get part of file content and separator', async() => {
    const mockPreview = {
      separator: '\t',
      columns: [
        'CHROM',
        'POS',
        'REF',
        'ALT'
      ],
      preview: [
        {
          CHROM: 'chr1',
          POS: '151405427',
          REF: 'T',
          ALT: 'TCGTCATCA'
        }
      ]
    };
    const httpPostSpy = jest.spyOn(HttpClient.prototype, 'post');
    httpPostSpy.mockReturnValue(of(mockPreview));

    const postResult = service.submitFile(new File(['mockData'], 'mockInput.tsv'));

    const res = await lastValueFrom(postResult.pipe(take(1)));
    expect(res).toStrictEqual(
      new FileContent('\t', ['CHROM', 'POS', 'REF', 'ALT'], [['chr1', '151405427', 'T', 'TCGTCATCA']]));
  });
});
