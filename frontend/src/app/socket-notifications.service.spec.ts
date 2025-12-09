import { TestBed } from '@angular/core/testing';

import { SocketNotificationsService } from './socket-notifications.service';

describe('SocketNotificationsService', () => {
  let service: SocketNotificationsService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(SocketNotificationsService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
