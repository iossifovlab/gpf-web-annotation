import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { CookieService } from 'ngx-cookie-service';
import { BehaviorSubject, Observable, map, of, switchMap, take, tap } from 'rxjs';
import { environment } from '../../environments/environment';

export interface UserData {
  email: string;
  loggedIn: boolean;
  isAdmin: boolean;
}

@Injectable()
export class UsersService {
  private readonly registerUrl = `${environment.apiPath}/register`;
  private readonly loginUrl = `${environment.apiPath}/login`;
  private readonly logoutUrl = `${environment.apiPath}/logout`;
  private readonly userDataUrl = `${environment.apiPath}/user_info`;
  public userData = new BehaviorSubject<UserData>(null);

  public constructor(
    private http: HttpClient,
    private cookieService: CookieService,
    private router: Router,
  ) { }

  public logout(): Observable<object> {
    const csrfToken = this.cookieService.get('csrftoken');
    const headers = { 'X-CSRFToken': csrfToken };
    const options = { headers: headers, withCredentials: true };

    return this.http.get(this.logoutUrl, options).pipe(
      take(1),
      tap(() => {
        this.cookieService.delete('csrftoken');
        this.userData.next(null);
        this.router.navigate(['/single-annotation']);
      })
    );
  }

  public autoLogin(): Observable<boolean> {
    return this.getUserData().pipe(
      take(1),
      switchMap((userData: UserData) => {
        if (userData.loggedIn) {
          this.userData.next(userData);
          return of(true);
        }
        this.router.navigate(['/single-annotation']);
        return of(false);
      })
    );
  }

  public getUserData(): Observable<UserData> {
    const options = { withCredentials: true };
    return this.http.get<UserData>(this.userDataUrl, options);
  }

  public registerUser(email: string, password: string): Observable<object> {
    return this.http.post(
      this.registerUrl,
      {
        email: email,
        password: password,
      },
    );
  }

  public loginUser(email: string, password: string): Observable<void> {
    const csrfToken = this.cookieService.get('csrftoken');
    const headers = { 'X-CSRFToken': csrfToken };
    const options = { headers: headers, withCredentials: true };
    return this.http.post<UserData>(
      this.loginUrl,
      {
        email: email,
        password: password
      },
      options,
    ).pipe(
      map((userData: UserData) => {
        const fullUserData = { email: userData.email, isAdmin: userData.isAdmin, loggedIn: true} as UserData;
        this.userData.next(fullUserData);
      })
    );
  }
}
