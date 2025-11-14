import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SingleAnnotationComponent } from './single-annotation.component';
import { provideRouter, Router } from '@angular/router';
import { JobsService } from '../job-creation/jobs.service';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';

describe('SingleAnnotationComponent', () => {
  let component: SingleAnnotationComponent;
  let fixture: ComponentFixture<SingleAnnotationComponent>;
  let router: Router;

  beforeEach(async() => {
    await TestBed.configureTestingModule({
      imports: [SingleAnnotationComponent],
      providers: [
        provideRouter([]),
        JobsService,
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    }).compileComponents();

    router = TestBed.inject(Router);

    fixture = TestBed.createComponent(SingleAnnotationComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should reload and navigate to report page and pass parameters', async() => {
    component.pipelineId = 'example_pipeline';

    const navigateSpy = jest.spyOn(router, 'navigate');
    const navigateByUrlSpy = jest.spyOn(router, 'navigateByUrl');
    component.loadReport('variant1');

    // eslint-disable-next-line @typescript-eslint/await-thenable
    await navigateByUrlSpy;
    expect(navigateByUrlSpy).toHaveBeenCalledWith('/', { skipLocationChange: true });
    expect(navigateSpy).toHaveBeenCalledWith(
      ['/single-annotation/report'],
      {
        queryParams: {pipeline: 'example_pipeline', variant: 'variant1'},
      }
    );
  });

  it('should validate variant input', () => {
    component.validateVariant('chr1 11796321 G A');
    expect(component.validationMessage).toBe('');
    component.validateVariant('chr1 GTT A');
    expect(component.validationMessage).toBe('Invalid variant format!');
    component.validateVariant('chr1 100 GTT A');
    expect(component.validationMessage).toBe('');
    component.validateVariant('chr7 1    GTT A');
    expect(component.validationMessage).toBe('Invalid variant format!');
    component.validateVariant('  chr1 11796321 G A ');
    expect(component.validationMessage).toBe('');
  });

  it('should validate position of a variant', () => {
    expect(component.isPosValid('11796321')).toBe(true);
    expect(component.isPosValid('pos:11796321')).toBe(false);
  });

  it('should validate reference of a variant', () => {
    expect(component.isRefValid('G')).toBe(true);
    expect(component.isRefValid('GT')).toBe(true);
    expect(component.isRefValid('ZZ')).toBe(false);
    expect(component.isRefValid('GT,N')).toBe(false);
    expect(component.isRefValid('aaa')).toBe(true);
    expect(component.isRefValid('')).toBe(false);
  });

  it('should validate alternative of a variant', () => {
    expect(component.isAltValid('A')).toBe(true);
    expect(component.isAltValid('GT')).toBe(true);
    expect(component.isAltValid('GT,N')).toBe(true);
    expect(component.isAltValid('gt,a')).toBe(true);
    expect(component.isAltValid('A,NN,NNP')).toBe(false);
    expect(component.isAltValid('')).toBe(true);
  });
});
