import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { UserData, UsersService } from './users.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, CommonModule],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
})
export class AppComponent implements OnInit {
  public description = 'GPF Web Annotation description';
  public currentUserData: UserData = null;

  public constructor(private router: Router, private usersService: UsersService) {}

  public ngOnInit(): void {
    this.usersService.userData.subscribe((userData) => {
      this.currentUserData = userData;
    });
  }
}
