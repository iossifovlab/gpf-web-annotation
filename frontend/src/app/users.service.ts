import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, map } from 'rxjs';
import { environment } from '../../environments/environment';

export interface UserData {
  email: string;
  isAdmin: boolean;
}

@Injectable()
export class UsersService {
  private readonly registerUrl = `${environment.basePath}/register`;
  private readonly loginUrl = `${environment.basePath}/login`;
  public userData = new BehaviorSubject<UserData>(null);

  public constructor(
    private http: HttpClient,
  ) { }

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
    ).pipe(
      map((userData: UserData) => {
        this.userData.next(userData);
      })
    );
  }
}
