import { Component, Input, OnDestroy, OnInit } from '@angular/core';
import { SocketNotificationsService } from '../socket-notifications.service';
import { concatMap, delay, of } from 'rxjs';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-socket-notifications',
  imports: [CommonModule],
  templateUrl: './socket-notifications.component.html',
  styleUrl: './socket-notifications.component.css'
})
export class SocketNotificationsComponent implements OnInit, OnDestroy {
  @Input() public type: 'pipeline' | 'job' | 'single annotation';
  public socketMessages: string[] = [];
  public constructor(
      private socketNotificationsService: SocketNotificationsService,
  ) { }

  public ngOnInit(): void {
    this.setupWebSocketConnection();
  }

  private setupWebSocketConnection(): void {
    this.socketNotificationsService.getSocketNotifications().pipe(
      concatMap(x => of(x).pipe(delay(1000))) // added delay to better visualize messages
    ).subscribe({
      // Called whenever there is a message from the server.
      next: (msg: {message: string, type: string}) => {
        this.addNotification(msg);
      },
      // Called if at any point WebSocket API signals some kind of error.
      error: err => {
        console.error(err);
      },
      // Called when connection is closed (for whatever reason).
      complete: () => {
        this.socketMessages = [];
      }
    });
  }

  public ngOnDestroy(): void {
    this.socketNotificationsService.closeConnection();
  }

  private addNotification(notification: {message: string, type: string}): void {
    if (this.type && notification.type !== this.type) {
      return;
    }
    this.socketMessages.push(notification.message);
  }
}
