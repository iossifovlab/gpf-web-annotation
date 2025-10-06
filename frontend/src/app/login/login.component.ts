import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { UsersService } from '../users.service';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-login',
  imports: [FormsModule, CommonModule, RouterModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css',
})
export class LoginComponent implements OnInit {
  @ViewChild('emailInput') private email!: ElementRef;
  @ViewChild('passwordInput') private password!: ElementRef;
  public responseMessage: string = '';
  public readonly environment = environment;

  public constructor(private usersService: UsersService, private router: Router) {}

  public ngOnInit(): void {
    if (this.usersService.isUserLoggedIn()) {
      this.usersService.autoLogin();
    }
  }

  public login(): void {
    this.responseMessage = '';
    const email = (this.email.nativeElement as HTMLInputElement).value;
    const password = (this.password.nativeElement as HTMLInputElement).value;
    this.usersService.loginUser(email, password).subscribe({
      next: () => {
        this.cleanInputs();
        this.router.navigate(['/single-annotation']);
      },
      error: (error: HttpErrorResponse) => {
        this.responseMessage = (error.error as {error: string})['error'] || 'Login failed!';
      }
    });
  }

  private cleanInputs(): void {
    (this.email.nativeElement as HTMLInputElement).value = '';
    (this.password.nativeElement as HTMLInputElement).value = '';
  }
}
