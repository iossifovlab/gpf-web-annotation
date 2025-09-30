import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SingleAnnotationComponent } from './single-annotation.component';
import { Observable, of } from 'rxjs';
import { SingleAnnotationService } from '../single-annotation.service';
import { provideRouter } from '@angular/router';

class SingleAnnotationServiceMock {
  public getGenomes(): Observable<string[]> {
    return of(['hg38', 'hg19']);
  }
}

describe('SingleAnnotationComponent', () => {
  let component: SingleAnnotationComponent;
  let fixture: ComponentFixture<SingleAnnotationComponent>;
  const singleAnnotationService = new SingleAnnotationServiceMock();

  beforeEach(async() => {
    await TestBed.configureTestingModule({
      imports: [SingleAnnotationComponent],
      providers: [
        provideRouter([]),
      ],
    }).compileComponents();

    TestBed.overrideProvider(SingleAnnotationService, {useValue: singleAnnotationService});

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
    component.selectedGenome = 'hg19';
    const routerSpy = jest.spyOn((component as any).router, 'navigate');
    component.loadReport('variant1');
    expect(routerSpy).toHaveBeenCalledWith(
      ['report'],
      { queryParams: {genome: 'hg19', variant: 'variant1'}, relativeTo: (component as any).route }
    );
  });
});
