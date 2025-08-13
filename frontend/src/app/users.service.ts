import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

@Injectable()
export class UsersService {
  private readonly registerUrl = 'http://localhost:8000/register/';
  private readonly loginUrl = 'http://localhost:8000/login/';

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

  public loginUser(email: string, password: string): Observable<object> {
    return this.http.post(
      this.loginUrl,
      {
        email: email,
        password: password
      },
    );
  }
}
