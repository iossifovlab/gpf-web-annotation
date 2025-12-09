import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SocketNotificationsComponent } from './socket-notifications.component';

describe('SocketNotificationsComponent', () => {
  let component: SocketNotificationsComponent;
  let fixture: ComponentFixture<SocketNotificationsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SocketNotificationsComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(SocketNotificationsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
