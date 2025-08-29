import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { CookieService } from 'ngx-cookie-service';
import { BehaviorSubject, Observable, map, take, tap } from 'rxjs';

export interface UserData {
  email: string;
  isAdmin: boolean;
}

@Injectable()
export class UsersService {
  private readonly registerUrl = 'http://localhost:8000/register/';
  private readonly loginUrl = 'http://localhost:8000/login/';
  private readonly userDataUrl = 'http://localhost:8000/user_info/';
  public userData = new BehaviorSubject<UserData>(null);

  public constructor(
    private http: HttpClient,
    private cookieService: CookieService,
    private router: Router
  ) { }

  public autoLogin(): void {
    if (this.cookieService.get('csrftoken')) {
      this.getUserData().pipe(take(1)).subscribe();
    }
  }

  public getUserData(): Observable<UserData> {
    const options = { withCredentials: true };

    return this.http.get<UserData>(this.userDataUrl, options).pipe(
      tap((userData: UserData) => {
        this.userData.next(userData);
        this.router.navigate(['/home']);
      })
    );
  }

  public registerUser(email: string, password: string): Observable<object> {
    return this.http.post(
      this.registerUrl,
      {
        email: email,
        password: password
      },
    );
  }

  public loginUser(email: string, password: string): Observable<void> {
    return this.http.post<UserData>(
      this.loginUrl,
      {
        email: email,
        password: password
      },
      { withCredentials: true },
    ).pipe(
      map((userData: UserData) => {
        this.userData.next(userData);
      })
    );
  }
}
