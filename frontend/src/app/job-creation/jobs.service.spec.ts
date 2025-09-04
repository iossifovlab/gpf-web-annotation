import { TestBed } from '@angular/core/testing';
import { HttpClient, HttpResponse, provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { lastValueFrom, of, take } from 'rxjs';
import { JobsService } from './jobs.service';
import { getStatusClassName, Job } from './jobs';

const jobsMockJson = [
  { id: 1, created: '1.10.2025', owner: 'test@email.com', status: 2 },
  { id: 2, created: '1.10.2025', owner: 'test@email.com', status: 4 },
  { id: 3, created: '1.10.2025', owner: 'test@email.com', status: 3 },
  { id: 4, created: '1.10.2025', owner: 'test@email.com', status: 1 },
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
    httpPostSpy.mockReturnValue(of(new HttpResponse({status: 204})));

    const mockInputFile = new File(['mockData'], 'mockInput.vcf');

    const postResult = service.createJob(mockInputFile, null, 'mockConfigData');

    const res = await lastValueFrom(postResult.pipe(take(1)));
    const httpResponse = new HttpResponse(res);
    expect(httpResponse.status).toBe(204);
  });

  it('should create job with config chosen from pipeline list by user', async() => {
    const httpPostSpy = jest.spyOn(HttpClient.prototype, 'post');
    httpPostSpy.mockReturnValue(of(new HttpResponse({status: 204})));

    const mockInputFile = new File(['mockData'], 'mockInput.vcf');

    const postResult = service.createJob(mockInputFile, 'autism', null);

    const res = await lastValueFrom(postResult.pipe(take(1)));
    const httpResponse = new HttpResponse(res);
    expect(httpResponse.status).toBe(204);
  });

  it('should check if create query has correct parameters when config is written by user', () => {
    const httpPostSpy = jest.spyOn(HttpClient.prototype, 'post');
    httpPostSpy.mockReturnValue(of(new HttpResponse({status: 204})));

    const mockInputFile = new File(['mockData'], 'mockInput.vcf');
    const mockConfigCntent = 'mockConfigCntent';
    const mockConfigFile = new File([mockConfigCntent], 'mockConfig.vcf');

    const formData = new FormData();
    formData.append('data', mockInputFile, 'mockInput.vcf');
    formData.append('config', mockConfigFile);

    const options = {
      headers: {
        'X-CSRFToken': ''
      },
      withCredentials: true
    };

    service.createJob(mockInputFile, null, mockConfigCntent);

    expect(httpPostSpy).toHaveBeenCalledWith(
      'http://localhost:8000/jobs/create/',
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
    formData.append('pipeline', 'autism');

    const options = {
      headers: {
        'X-CSRFToken': ''
      },
      withCredentials: true
    };

    service.createJob(mockInputFile, 'autism', null);

    expect(httpPostSpy).toHaveBeenCalledWith(
      'http://localhost:8000/jobs/create/',
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
    formData.append('config', mockConfigFile);

    const mockCookie = 'csrftoken=EYZbFmv1i1Ie7cmT3OFHgxdv3kOR7rIt';
    document.cookie = mockCookie;

    const options = {
      headers: {
        'X-CSRFToken': 'EYZbFmv1i1Ie7cmT3OFHgxdv3kOR7rIt'
      },
      withCredentials: true
    };

    service.createJob(mockInputFile, null, mockConfigCntent);
    expect(httpPostSpy).toHaveBeenCalledWith(
      'http://localhost:8000/jobs/create/',
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
      'http://localhost:8000/jobs/',
      options
    );
  });

  it('should get users jobs and create list with job objects from response', async() => {
    const httpGetSpy = jest.spyOn(HttpClient.prototype, 'get');
    httpGetSpy.mockReturnValue(of(jobsMockJson));

    const jobsMockResult = [
      new Job(1, new Date('1.10.2025'), 'test@email.com', 'in process'),
      new Job(2, new Date('1.10.2025'), 'test@email.com', 'failed'),
      new Job(3, new Date('1.10.2025'), 'test@email.com', 'success'),
      new Job(4, new Date('1.10.2025'), 'test@email.com', 'waiting'),
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
        status: 1,
        owner: 'register@email.com'
      }
    ));

    const job = new Job(16, new Date('2025-08-26'), 'register@email.com', 'waiting');

    const getResponse = service.getJobDetails(16);

    const res = await lastValueFrom(getResponse.pipe(take(1)));
    expect(res).toStrictEqual(job);
  });


  it('should create annotated file download link', () => {
    const url = service.getDownloadJobResultLink(10);
    expect(url).toBe('http://localhost:8000/jobs/10/file/result/');
  });

  it('should create config file download link', () => {
    const url = service.getJobConfigLink(10);
    expect(url).toBe('http://localhost:8000/jobs/10/file/config/');
  });

  it('should create input file download link', () => {
    const url = service.getJobInputDownloadLink(10);
    expect(url).toBe('http://localhost:8000/jobs/10/file/input/');
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
});
