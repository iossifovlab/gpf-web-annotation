import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, DoCheck } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { UserData, UsersService } from './users.service';
import { takeWhile } from 'rxjs';
import { environment } from '../../environments/environment';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, CommonModule],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
})
export class AppComponent implements DoCheck {
  public description = 'GPF Web Annotation description';
  public currentUserData: UserData = null;
  public readonly environment = environment;

  public constructor(
    private router: Router,
    private usersService: UsersService,
    private changeDetectorRef: ChangeDetectorRef
  ) { }

  public ngDoCheck(): void {
    this.usersService.userData.pipe(
      takeWhile(user => user?.email !== this.currentUserData?.email),
    ).subscribe((userData) => {
      this.currentUserData = userData;
    });
    this.changeDetectorRef.detectChanges();
  }

  public logout(): void {
    this.usersService.userData.next(null);
    this.router.navigate(['/login']);
  }
}
