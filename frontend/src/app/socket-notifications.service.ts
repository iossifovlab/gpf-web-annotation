import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { webSocket, WebSocketSubject } from 'rxjs/webSocket';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class SocketNotificationsService {
  public constructor() { }

  private readonly socketNotificationsUrl = `${environment.socketPath}/notifications`;
  private socketNotifications: WebSocketSubject<object> = webSocket(this.socketNotificationsUrl);

  public getSocketNotifications(): Observable<{message: string, type: string}> {
    return this.socketNotifications.asObservable() as Observable<{message: string, type: string}>;
  }

  public closeConnection(): void {
    this.socketNotifications.complete();
  }
}
