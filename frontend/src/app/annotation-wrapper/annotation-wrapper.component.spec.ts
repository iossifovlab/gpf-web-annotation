import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AnnotationWrapperComponent } from './annotation-wrapper.component';
import { JobsService } from '../job-creation/jobs.service';
import { provideHttpClient } from '@angular/common/http';
import { UsersService } from '../users.service';
import { SingleAnnotationService } from '../single-annotation.service';

class UserServiceMock {
  public userData = {
    value: {
      limitations: {
        dailyJobs: 5,
        filesize: '64M',
        jobsLeft: 4,
        variantCount: 1000,
      }
    }
  };
}

describe('AnnotationWrapperComponent', () => {
  let component: AnnotationWrapperComponent;
  let fixture: ComponentFixture<AnnotationWrapperComponent>;
  const userServiceMock = new UserServiceMock();

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [AnnotationWrapperComponent],
      providers: [
        JobsService,
        {
          provide: UsersService,
          useValue: userServiceMock
        },
        SingleAnnotationService,
        provideHttpClient()
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(AnnotationWrapperComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
