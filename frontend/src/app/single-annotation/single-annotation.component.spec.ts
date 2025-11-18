import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SingleAnnotationComponent } from './single-annotation.component';
import { provideRouter } from '@angular/router';
import { JobsService } from '../job-creation/jobs.service';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { SingleAnnotationService } from '../single-annotation.service';

describe('SingleAnnotationComponent', () => {
  let component: SingleAnnotationComponent;
  let fixture: ComponentFixture<SingleAnnotationComponent>;

  beforeEach(async() => {
    await TestBed.configureTestingModule({
      imports: [SingleAnnotationComponent],
      providers: [
        SingleAnnotationService,
        provideRouter([]),
        JobsService,
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

  it('should validate variant input', () => {
    component.currentAlleleInput = 'chr1 11796321 G A';
    component.validateVariant();
    expect(component.validationMessage).toBe('');

    component.currentAlleleInput = 'chr1 GTT A';
    component.validateVariant();
    expect(component.validationMessage).toBe('Invalid variant format!');

    component.currentAlleleInput = 'chr1 100 GTT A';
    component.validateVariant();
    expect(component.validationMessage).toBe('');

    component.currentAlleleInput = 'chr7 1    GTT A';
    component.validateVariant();
    expect(component.validationMessage).toBe('Invalid variant format!');

    component.currentAlleleInput = '  chr1 11796321 G A ';
    component.validateVariant();
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
