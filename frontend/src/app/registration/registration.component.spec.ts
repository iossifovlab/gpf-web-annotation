import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RegistrationComponent } from './registration.component';
import { provideHttpClient } from '@angular/common/http';
import { Observable, of, throwError } from 'rxjs';
import { UsersService } from '../users.service';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { By } from '@angular/platform-browser';

class UsersServiceMock {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public registerUser(email: string, password: string): Observable<object> {
    return of({});
  }
}

describe('RegistrationComponent', () => {
  let component: RegistrationComponent;
  let fixture: ComponentFixture<RegistrationComponent>;
  const usersServiceMock = new UsersServiceMock();
  let emailInput: HTMLInputElement;
  let passwordInput: HTMLInputElement;
  let templateRef: HTMLElement;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [RegistrationComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting()
      ]
    }).compileComponents();

    TestBed.overrideProvider(UsersService, {useValue: usersServiceMock});

    fixture = TestBed.createComponent(RegistrationComponent);
    component = fixture.componentInstance;

    templateRef = fixture.debugElement.nativeElement as HTMLElement;
    emailInput = templateRef.querySelector('#email') as HTMLInputElement;
    passwordInput = templateRef.querySelector('#password') as HTMLInputElement;

    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should successfully register user', () => {
    emailInput.value = 'mockEmail@email.com';
    passwordInput.value = 'mockPassword';
    const registerSpy = jest.spyOn(usersServiceMock, 'registerUser');

    component.register();
    expect(registerSpy).toHaveBeenCalledWith('mockEmail@email.com', 'mockPassword');
    expect(component.responseMessage).toBe('Registration successful!');
    expect(emailInput.value).toBe('');
    expect(passwordInput.value).toBe('');
  });

  it('should show error message when user registration is failed', () => {
    emailInput.value = 'mockEmail@email.com';
    passwordInput.value = 'mockPassword';
    const registerSpy = jest.spyOn(usersServiceMock, 'registerUser')
      .mockReturnValue(throwError(() => new Error()));

    component.register();
    expect(registerSpy).toHaveBeenCalledWith('mockEmail@email.com', 'mockPassword');
    expect(component.responseMessage).toBe('Registration failed!');
    expect(emailInput.value).toBe('mockEmail@email.com');
    expect(passwordInput.value).toBe('mockPassword');
  });

  it('should show error message when email is in invalid', () => {
    emailInput.value = 'mockInvalidEmail';
    const registerSpy = jest.spyOn(usersServiceMock, 'registerUser');

    component.register();
    expect(registerSpy).not.toHaveBeenCalledWith();
    expect(component.validationMessage).toBe('Invalid email format.');
    expect(emailInput.value).toBe('mockInvalidEmail');
  });

  it('should show error message when password is in invalid', () => {
    emailInput.value = 'mockEmail@email.com';
    passwordInput.value = '12';
    const registerSpy = jest.spyOn(usersServiceMock, 'registerUser');

    component.register();
    expect(registerSpy).not.toHaveBeenCalledWith();
    expect(component.validationMessage).toBe('Password must be at least 6 characters long.');
    expect(emailInput.value).toBe('mockEmail@email.com');
    expect(passwordInput.value).toBe('12');
  });

  it('should focus email input when trying to create user without email', () => {
    emailInput.value = '';
    const registerSpy = jest.spyOn(usersServiceMock, 'registerUser');

    component.register();
    expect(registerSpy).not.toHaveBeenCalledWith();
    const focusedElement = fixture.debugElement.query(By.css(':focus')).nativeElement as HTMLInputElement;
    expect(focusedElement).toBe(emailInput);
    expect(component.validationMessage).toBe('');
  });

  it('should focus password input when trying to create user without password', () => {
    emailInput.value = 'mockEmail@email.com';
    passwordInput.value = '';
    const registerSpy = jest.spyOn(usersServiceMock, 'registerUser');

    component.register();
    expect(registerSpy).not.toHaveBeenCalledWith();
    const focusedElement = fixture.debugElement.query(By.css(':focus')).nativeElement as HTMLInputElement;
    expect(focusedElement).toBe(passwordInput);
    expect(component.validationMessage).toBe('');
  });
});
