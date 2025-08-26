import { TestBed } from '@angular/core/testing';

import { UserData, UsersService } from './users.service';
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

    const postResult = service.registerUser('mockEmail@email.com', 'mockPassword');
    expect(httpPostSpy).toHaveBeenCalledWith(
      'http://localhost:8000/register/',
      {
        email: 'mockEmail@email.com',
        password: 'mockPassword'
      }
    );

    const res = await lastValueFrom(postResult.pipe(take(1)));
    expect(res).toBe('mockResponse');
  });

  it('should check post request params when login user', () => {
    const mockUserData = { email: 'mockEmail@email.com', isAdmin: false } as UserData;
    const httpPostSpy = jest.spyOn(HttpClient.prototype, 'post');
    httpPostSpy.mockReturnValue(of(mockUserData));

    service.loginUser('mockEmail@email.com', 'mockPassword');
    expect(httpPostSpy).toHaveBeenCalledWith(
      'http://localhost:8000/login/',
      {
        email: 'mockEmail@email.com',
        password: 'mockPassword'
      },
      { withCredentials: true }
    );
  });

  it('should store current user in subject after login', async() => {
    const mockUserData = { email: 'mockEmail@email.com', isAdmin: false } as UserData;
    const httpPostSpy = jest.spyOn(HttpClient.prototype, 'post');
    httpPostSpy.mockReturnValue(of(mockUserData));

    const postResult = service.loginUser('mockEmail@email.com', 'mockPassword');

    await lastValueFrom(postResult.pipe(take(1)));
    expect(service.userData.value).toStrictEqual(mockUserData);
  });
});
