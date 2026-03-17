import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SingleAnnotationComponent } from './single-annotation.component';
import { provideRouter } from '@angular/router';
import { JobsService } from '../job-creation/jobs.service';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { SingleAnnotationService } from '../single-annotation.service';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { Annotator, AnnotatorDetails, Resource, SingleAnnotationReport, Annotatable } from '../single-annotation';
import { UserData, UsersService } from '../users.service';
import { MatTooltip } from '@angular/material/tooltip';

const mockReport = new SingleAnnotationReport(
  new Annotatable('chr14', 204000100, 'A', 'AA', 'ins', null, null),
  [
    new Annotator(new AnnotatorDetails('allele_score', 'desc', [new Resource('resourceId', 'resourceUrl')]), [])
  ],
);
class MockSingleAnnotationService {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public getReport(annotatable: Annotatable, pipeline: string): Observable<SingleAnnotationReport> {
    return of(mockReport);
  }
}

const mockUser: UserData = {
  email: 'mockEmail',
  loggedIn: true,
  isAdmin: false,
  limitations: {
    dailyJobs: 10,
    filesize: '10MB',
    todayJobsCount: 10,
    variantCount: 20,
    diskSpace: '100'
  }
};
class MockUsersService {
  public userData = new BehaviorSubject<UserData>(mockUser);
}

describe('SingleAnnotationComponent', () => {
  let component: SingleAnnotationComponent;
  let fixture: ComponentFixture<SingleAnnotationComponent>;
  const mockSingleAnnotationService = new MockSingleAnnotationService();
  const mockUsersService = new MockUsersService();


  beforeEach(async() => {
    await TestBed.configureTestingModule({
      imports: [SingleAnnotationComponent],
      providers: [
        {
          provide: SingleAnnotationService,
          useValue: mockSingleAnnotationService
        },
        {
          provide: UsersService,
          useValue: mockUsersService
        },
        provideRouter([]),
        JobsService,
        MatTooltip,
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(SingleAnnotationComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should not show error message for valid alleles', () => {
    component.currentAllele = 'chr1 11796321 G A';
    component.pipelineId = 'pipelineId';
    component.annotateAllele();
    expect(component.validationMessage).toBe('');

    component.currentAllele = 'chr1 100 GTT A';
    component.annotateAllele();
    expect(component.validationMessage).toBe('');

    component.currentAllele = '  chr1 11796321 G A ';
    component.annotateAllele();
    expect(component.validationMessage).toBe('');

    component.currentAllele = 'chr1:11796321:G:A';
    component.annotateAllele();
    expect(component.validationMessage).toBe('');

    component.currentAllele = 'chr1:11796321';
    component.annotateAllele();
    expect(component.validationMessage).toBe('');

    component.currentAllele = 'chr1 11796321';
    component.annotateAllele();
    expect(component.validationMessage).toBe('');

    component.currentAllele = 'chr1 11796321 G\'>\'A';
    component.annotateAllele();
    expect(component.validationMessage).toBe('');

    component.currentAllele = 'chr1:11796321:G\'>\'A';
    component.annotateAllele();
    expect(component.validationMessage).toBe('');

    component.currentAllele = 'chr1:11796321-11800000';
    component.annotateAllele();
    expect(component.validationMessage).toBe('');

    component.currentAllele = 'chr1 11796321 11800000';
    component.annotateAllele();
    expect(component.validationMessage).toBe('');

    component.currentAllele = 'chr1:11796321 G A';
    component.annotateAllele();
    expect(component.validationMessage).toBe('');

    component.currentAllele = 'chr1\t11796321\tG\tA';
    component.annotateAllele();
    expect(component.validationMessage).toBe('');

    component.currentAllele = 'chr1\t11796321\t\tG A';
    component.annotateAllele();
    expect(component.validationMessage).toBe('');

    component.currentAllele = 'chr7 1     GTT A';
    component.annotateAllele();
    expect(component.validationMessage).toBe('');

    component.currentAllele = 'chr1:11796321:G::A';
    component.annotateAllele();
    expect(component.validationMessage).toBe('');

    component.currentAllele = 'chr1  11796321      G   ::A';
    component.annotateAllele();
    expect(component.validationMessage).toBe('');
  });

  it('should show error message for invalid alleles', () => {
    component.pipelineId = 'pipelineId';

    component.currentAllele = 'chr1 GTT A';
    component.annotateAllele();
    expect(component.validationMessage).toBe('Invalid allele format or missing pipeline!');

    component.currentAllele = 'chr1:aaaa';
    component.annotateAllele();
    expect(component.validationMessage).toBe('Invalid allele format or missing pipeline!');

    component.currentAllele = 'chr1 11796321aaa';
    component.annotateAllele();
    expect(component.validationMessage).toBe('Invalid allele format or missing pipeline!');

    component.currentAllele = 'chr1 11796321 Gav\'>\'A';
    component.annotateAllele();
    expect(component.validationMessage).toBe('Invalid allele format or missing pipeline!');

    component.currentAllele = 'chr1:-11796321';
    component.annotateAllele();
    expect(component.validationMessage).toBe('Invalid allele format or missing pipeline!');

    component.currentAllele = 'chr1:11796321-111';
    component.annotateAllele();
    expect(component.validationMessage).toBe('Invalid allele format or missing pipeline!');

    component.currentAllele = 'chr1 11796321 11796321';
    component.annotateAllele();
    expect(component.validationMessage).toBe('Invalid allele format or missing pipeline!');

    component.currentAllele = 'chr1:11796321:G>A';
    component.annotateAllele();
    expect(component.validationMessage).toBe('Invalid allele format or missing pipeline!');

    component.currentAllele = 'chr1:11796321:G > A';
    component.annotateAllele();
    expect(component.validationMessage).toBe('Invalid allele format or missing pipeline!');

    component.currentAllele = 'chr1:11796321--11800000';
    component.annotateAllele();
    expect(component.validationMessage).toBe('Invalid allele format or missing pipeline!');
  });

  it('should check if position of an allele is valid', () => {
    component.currentAllele = 'chr1 11796321 G A';
    component.pipelineId = 'pipelineId';
    component.annotateAllele();
    expect(component.validationMessage).toBe('');

    component.currentAllele = 'chr1 pos:11796321 G A';
    component.annotateAllele();
    expect(component.validationMessage).toBe('Invalid allele format or missing pipeline!');
  });

  it('should check if reference of an allele is valid', () => {
    component.currentAllele = 'chr1 11796321 G A';
    component.pipelineId = 'pipelineId';
    component.annotateAllele();
    expect(component.validationMessage).toBe('');

    component.currentAllele = 'chr1 11796321 GT A';
    component.annotateAllele();
    expect(component.validationMessage).toBe('');

    component.currentAllele = 'chr1 11796321 ZZ A';
    component.annotateAllele();
    expect(component.validationMessage).toBe('Invalid allele format or missing pipeline!');

    component.currentAllele = 'chr1 11796321 GT,N A';
    component.annotateAllele();
    expect(component.validationMessage).toBe('Invalid allele format or missing pipeline!');

    component.currentAllele = 'chr1 11796321 aaa A';
    component.annotateAllele();
    expect(component.validationMessage).toBe('');

    component.currentAllele = 'chr1 11796321  A';
    component.annotateAllele();
    expect(component.validationMessage).toBe('Invalid allele format or missing pipeline!');
  });

  it('should check if alternative of an allele is valid', () => {
    component.currentAllele = 'chr1 11796321 G A';
    component.pipelineId = 'pipelineId';
    component.annotateAllele();
    expect(component.validationMessage).toBe('');

    component.currentAllele = 'chr1 11796321 G GT';
    component.annotateAllele();
    expect(component.validationMessage).toBe('');

    component.currentAllele = 'chr1 11796321 G GT,N';
    component.annotateAllele();
    expect(component.validationMessage).toBe('');

    component.currentAllele = 'chr1 11796321 G gt,a';
    component.annotateAllele();
    expect(component.validationMessage).toBe('');

    component.currentAllele = 'chr1 11796321 G A,NN,NNP';
    component.annotateAllele();
    expect(component.validationMessage).toBe('Invalid allele format or missing pipeline!');

    component.currentAllele = 'chr1 11796321 G  ';
    component.annotateAllele();
    expect(component.validationMessage).toBe('Invalid allele format or missing pipeline!');
  });

  it('should get report when clicking go button and input is valid', () => {
    component.currentAllele = 'chr1 11796321 G GT';
    component.pipelineId = 'pipelineId';
    component.isPipelineValid = true;
    const getReportSpy = jest.spyOn(mockSingleAnnotationService, 'getReport');

    component.annotateAllele();
    expect(component.report).toBe(mockReport);
    expect(getReportSpy).toHaveBeenCalledWith(new Annotatable(
      'chr1',
      11796321,
      'G',
      'GT',
      null,
      null,
      null
    ), 'pipelineId');
  });

  it('should set report to null when input is not valid', () => {
    component.currentAllele = 'chr1 11796321 G NNP';
    component.annotateAllele();
    expect(component.report).toBeNull();
  });

  it('should trigger update table in parent after getting the report', () => {
    component.pipelineId = 'pipelineId';
    component.isPipelineValid = true;
    component.currentAllele = 'chr1 11796321 G GT';
    const emitSpy = jest.spyOn(component.alleleUpdateEmit, 'emit');

    component.annotateAllele();
    expect(emitSpy).toHaveBeenCalledWith();
  });

  it('should not trigger update table in parent after getting the report when user is anonymous', () => {
    component.currentAllele = 'chr1 11796321 G GT';
    const emitSpy = jest.spyOn(component.alleleUpdateEmit, 'emit');

    mockUsersService.userData = null;

    component.annotateAllele();
    expect(emitSpy).not.toHaveBeenCalledWith();
  });
});
