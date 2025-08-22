import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { JobCreationComponent } from '../job-creation/job-creation.component';
import { MatDialog } from '@angular/material/dialog';

@Component({
  selector: 'app-home',
  imports: [CommonModule],
  templateUrl: './home.component.html',
  styleUrl: './home.component.css'
})
export class HomeComponent {
  public jobs: string[] = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];

  public constructor(private dialog: MatDialog) {}

  public openModal(): void {
    const dialogRef = this.dialog.open(JobCreationComponent, {
      height: '60vh',
      width: '50vw',
    });

    dialogRef.afterClosed().subscribe((confirmed: boolean) => {
      
    });
  }
}
