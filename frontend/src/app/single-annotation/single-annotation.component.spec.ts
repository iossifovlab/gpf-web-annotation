import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SingleAnnotationComponent } from './single-annotation.component';
import { Observable, of } from 'rxjs';
import { SingleAnnotationService } from '../single-annotation.service';
import { ActivatedRoute, provideRouter, Router } from '@angular/router';

class SingleAnnotationServiceMock {
  public getGenomes(): Observable<string[]> {
    return of(['hg38', 'hg19']);
  }
}

describe('SingleAnnotationComponent', () => {
  let component: SingleAnnotationComponent;
  let fixture: ComponentFixture<SingleAnnotationComponent>;
  const singleAnnotationService = new SingleAnnotationServiceMock();
  let router: Router;

  beforeEach(async() => {
    await TestBed.configureTestingModule({
      imports: [SingleAnnotationComponent],
      providers: [
        provideRouter([]),
      ],
    }).compileComponents();

    TestBed.overrideProvider(SingleAnnotationService, {useValue: singleAnnotationService});
    router = TestBed.inject(Router);

    fixture = TestBed.createComponent(SingleAnnotationComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should get genomes on component initialization', () => {
    component.ngOnInit();
    expect(component.genomes).toStrictEqual(['hg38', 'hg19']);
    expect(component.selectedGenome).toBe('hg38');
  });

  it('should navigate to report page with and pass parameters', () => {
    const activatedRoute = TestBed.inject(ActivatedRoute);
    component.selectedGenome = 'hg19';

    const navigateSpy = jest.spyOn(router, 'navigate');
    component.loadReport('variant1');
    expect(navigateSpy).toHaveBeenCalledWith(
      ['report'],
      { queryParams: {genome: 'hg19', variant: 'variant1'}, relativeTo: activatedRoute }
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
  });

  it('should validate chromosome of a variant for hg19', () => {
    component.selectedGenome = 'hg19';
    expect(component.isChromValid('chr1')).toBe(false);
    expect(component.isChromValid('20')).toBe(true);
    expect(component.isChromValid('chrX')).toBe(false);
    expect(component.isChromValid('chr5:148481536')).toBe(false);
    expect(component.isChromValid('100')).toBe(false);
    expect(component.isChromValid('aaa')).toBe(false);
  });

  it('should validate chromosome of a variant for hg38', () => {
    component.selectedGenome = 'hg38';
    expect(component.isChromValid('chr1')).toBe(true);
    expect(component.isChromValid('20')).toBe(false);
    expect(component.isChromValid('chrX')).toBe(true);
    expect(component.isChromValid('chr5:148481536')).toBe(false);
    expect(component.isChromValid('100')).toBe(false);
    expect(component.isChromValid('aaa')).toBe(false);
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
