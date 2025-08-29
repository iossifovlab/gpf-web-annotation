import { TestBed } from '@angular/core/testing';

import { UserData, UsersService } from './users.service';
import { HttpClient, provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { lastValueFrom, of, take } from 'rxjs';
import { CookieService } from 'ngx-cookie-service';

class CookieServiceMock {
  public get(): string {
    return '';
  }
}
describe('UsersService', () => {
  let service: UsersService;
  const cookieServiceMock = new CookieServiceMock();

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        UsersService,
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: CookieService, useValue: cookieServiceMock }
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

  it('should get user data if there is csrf token in cookies', () => {
    const getUserDataSpy = jest.spyOn(service, 'getUserData');

    const mockCookie = 'csrftoken=EYZbFmv1i1Ie7cmT3OFHgxdv3kOR7rIt';
    jest.spyOn(cookieServiceMock, 'get').mockReturnValueOnce(mockCookie);

    service.autoLogin();
    expect(getUserDataSpy).toHaveBeenCalledWith();
  });

  it('should not requset user data if there is no csrf token in cookies', () => {
    const getUserDataSpy = jest.spyOn(service, 'getUserData');
    service.autoLogin();
    expect(getUserDataSpy).not.toHaveBeenCalledWith();
  });

  it('should check get user data query params', () => {
    const httpGetSpy = jest.spyOn(HttpClient.prototype, 'get');

    service.getUserData();
    expect(httpGetSpy).toHaveBeenCalledWith(
      'http://localhost:8000/user_info/',
      { withCredentials: true }
    );
  });

  it('should set current user after getting user data', () => {
    const httpGetSpy = jest.spyOn(HttpClient.prototype, 'get');
    httpGetSpy.mockReturnValue(of({ email: 'mockEmail', isAdmin: false }));

    const userDataMockResult = { email: 'mockEmail', isAdmin: false } as UserData;
    service.getUserData().subscribe();
    expect(service.userData.value).toStrictEqual(userDataMockResult);
  });
});
