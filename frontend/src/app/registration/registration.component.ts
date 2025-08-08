import { Component } from '@angular/core';
import { UsersService } from '../users.service';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-registration',
  imports: [FormsModule],
  templateUrl: './registration.component.html',
  styleUrl: './registration.component.css',
  providers: [UsersService]
})
export class RegistrationComponent {
  public email: string = '';
  public password: string = '';

  public constructor(private usersService: UsersService) {}

  public register(): void {
    this.usersService.registerUser(this.email, this.password).subscribe({
      next: (response) => {
        console.log('Registration successful', response);
      },
      error: (error) => {
        console.error('Registration failed', error);
      }
    });
  }
}
