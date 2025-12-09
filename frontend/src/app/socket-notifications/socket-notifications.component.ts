import { Component, Input, OnDestroy, OnInit } from '@angular/core';
import { SocketNotificationsService } from '../socket-notifications.service';
import { CommonModule } from '@angular/common';
import { JobNotification, PipelineNotification } from './socket-notifications';
import { concatMap, of, delay } from 'rxjs';

@Component({
  selector: 'app-socket-notifications',
  imports: [CommonModule],
  templateUrl: './socket-notifications.component.html',
  styleUrl: './socket-notifications.component.css'
})
export class SocketNotificationsComponent implements OnInit, OnDestroy {
  @Input() public componentType: 'pipeline' | 'job';
  public socketMessages: string[] = [];
  public constructor(
      private socketNotificationsService: SocketNotificationsService,
  ) { }

  public ngOnInit(): void {
    if (this.componentType === 'pipeline') {
      this.setupPipelineWebSocketConnection();
    } else {
      this.setupJobWebSocketConnection();
    }
  }

  private setupPipelineWebSocketConnection(): void {
    this.socketNotificationsService.getPipelineNotifications().pipe(
      concatMap(x => of(x).pipe(delay(1000))) // added delay to better visualize messages
    ).subscribe({
      // Called whenever there is a message from the server.
      next: (notification: PipelineNotification) => {
        // eslint-disable-next-line @stylistic/max-len
        if (this.socketMessages.length && !this.socketMessages[this.socketMessages.length -1].includes(`Pipeline ${notification.pipelineId} `)) {
          this.clearMessages();
        }
        this.socketMessages.push(`Pipeline ${notification.pipelineId} is ${notification.status}`);
      },
      // Called if at any point WebSocket API signals some kind of error.
      error: err => {
        console.error(err);
      },
      // Called when connection is closed (for whatever reason).
      complete: () => {
        this.clearMessages();
      }
    });
  }

  private setupJobWebSocketConnection(): void {
    this.socketNotificationsService.getJobNotifications().pipe(
      concatMap(x => of(x).pipe(delay(1000))) // added delay to better visualize messages
    ).subscribe({
      // Called whenever there is a message from the server.
      next: (notification: JobNotification) => {
        // eslint-disable-next-line @stylistic/max-len
        if (this.socketMessages.length && !this.socketMessages[this.socketMessages.length -1].includes(`Job ${notification.jobId} `)) {
          this.clearMessages();
        }
        this.socketMessages.push(`Job ${notification.jobId} is ${notification.status}`);
      },
      // Called if at any point WebSocket API signals some kind of error.
      error: err => {
        console.error(err);
      },
      // Called when connection is closed (for whatever reason).
      complete: () => {
        this.clearMessages();
      }
    });
  }

  public ngOnDestroy(): void {
    this.socketNotificationsService.closeConnection();
  }

  public clearMessages(): void {
    this.socketMessages = [];
  }
}
