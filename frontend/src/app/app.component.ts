import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, DoCheck, OnInit } from '@angular/core';
import { Router, RouterModule, RouterOutlet } from '@angular/router';
import { UserData, UsersService } from './users.service';
import { takeWhile } from 'rxjs';
import { environment } from '../../environments/environment';
import { MarkdownModule } from 'ngx-markdown';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, CommonModule, RouterModule, MarkdownModule],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
})
export class AppComponent implements DoCheck, OnInit {
  public currentUserData: UserData = null;
  public readonly environment = environment;

  public constructor(
    private usersService: UsersService,
    private changeDetectorRef: ChangeDetectorRef,
    private router: Router,
  ) { }

  public ngOnInit(): void {
    this.usersService.refreshUserData();
  }

  public ngDoCheck(): void {
    this.usersService.userData.pipe(
      takeWhile(user => user?.email !== this.currentUserData?.email),
    ).subscribe((userData) => {
      this.currentUserData = userData;
    });
    this.changeDetectorRef.detectChanges();
  }

  public logout(): void {
    this.usersService.logout().subscribe(() => {
      this.currentUserData = null;
      window.location.reload();
      this.usersService.refreshUserData();
    });
  }

  public login(): void {
    this.router.navigate(['/login']);
  }

  public register(): void {
    this.router.navigate(['/register']);
  }

  public isAppHeaderVisible(): boolean {
    return !this.router.url.includes('login') && !this.router.url.includes('register');
  }
}
