import { TestBed } from '@angular/core/testing';

import { UsersService } from './users.service';
import { HttpClient, provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { lastValueFrom, of, take } from 'rxjs';

describe('UsersService', () => {
  let service: UsersService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        UsersService,
        provideHttpClient(),
        provideHttpClientTesting()
      ]
    });
    service = TestBed.inject(UsersService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should create user', async() => {
    const httpPostSpy = jest.spyOn(HttpClient.prototype, 'post');
    httpPostSpy.mockReturnValue(of('mockResponse'));

    const postResult = service.registerUser('mockEmail', 'mockPassword');
    expect(httpPostSpy).toHaveBeenCalledWith(
      '/register',
      {
        email: 'mockEmail',
        password: 'mockPassword'
      }
    );

    const res = await lastValueFrom(postResult.pipe(take(1)));
    expect(res).toBe('mockResponse');
  });
});
