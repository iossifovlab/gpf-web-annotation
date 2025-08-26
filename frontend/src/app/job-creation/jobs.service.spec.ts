import { TestBed } from '@angular/core/testing';
import { HttpClient, HttpResponse, provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { lastValueFrom, of, take } from 'rxjs';
import { JobsService } from './jobs.service';

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

  it('should create job', async() => {
    const httpPostSpy = jest.spyOn(HttpClient.prototype, 'post');
    httpPostSpy.mockReturnValue(of(new HttpResponse({status: 204})));

    const mockInputFile = new File(['mockData'], 'mockInput.vcf');

    const postResult = service.createJob(mockInputFile, 'mockConfigData');

    const res = await lastValueFrom(postResult.pipe(take(1)));
    const httpResponse = new HttpResponse(res);
    expect(httpResponse.status).toBe(204);
  });

  it('should check if create query has correct parameters', () => {
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

    service.createJob(mockInputFile, mockConfigCntent);

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

    service.createJob(mockInputFile, mockConfigCntent);
    expect(httpPostSpy).toHaveBeenCalledWith(
      'http://localhost:8000/jobs/create/',
      formData,
      options
    );
  });
});
