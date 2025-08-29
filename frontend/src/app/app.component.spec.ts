import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AppComponent } from './app.component';
import { UserData, UsersService } from './users.service';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { BehaviorSubject } from 'rxjs';

class UsersServiceMock {
  public userData = new BehaviorSubject<UserData>(null);
  public autoLogin(): void { }
}
describe('AppComponent', () => {
  let component: AppComponent;
  let fixture: ComponentFixture<AppComponent>;
  let router: Router;
  const usersServiceMock = new UsersServiceMock();

  beforeEach(async() => {
    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting()],
    }).compileComponents();

    TestBed.overrideProvider(UsersService, {useValue: usersServiceMock});

    router = TestBed.inject(Router);
    fixture = TestBed.createComponent(AppComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();

    jest.resetAllMocks();
    jest.clearAllMocks();
  });

  it('should create the app', () => {
    expect(component).toBeTruthy();
  });

  it('should have description', () => {
    expect(component.description).toBe('GPF Web Annotation description');
  });

  it('should render title', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('h1')?.textContent).toContain('GPF Web Annotation');
  });

  it('should set current user to null when logout', () => {
    component.logout();
    expect(component.currentUserData).toBeNull();
  });

  it('should redirect to login page when logout', () => {
    const navigateSpy = jest.spyOn(router, 'navigate');
    component.logout();
    expect(navigateSpy).toHaveBeenCalledWith(['/login']);
  });

  it('should get last logged in user from service', () => {
    const mockUserData = { email: 'mockEmail@email.com', isAdmin: false } as UserData;
    component.currentUserData = null;
    usersServiceMock.userData.next(mockUserData);
    component.ngDoCheck();
    expect(component.currentUserData).toStrictEqual(mockUserData);
  });
});
