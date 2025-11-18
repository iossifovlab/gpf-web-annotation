import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AllelesTableComponent } from './alleles-table.component';
import { SingleAnnotationService } from '../single-annotation.service';
import { Observable, of } from 'rxjs';

class SingleAnnotationServiceMock {
  public getAllelesHistory(): Observable<string[]> {
    return of(['chr1 11796321 G A', 'chr1 11796321 G TT']);
  }
}

describe('AllelesTableComponent', () => {
  let component: AllelesTableComponent;
  let fixture: ComponentFixture<AllelesTableComponent>;
  const singleAnnotationServiceMock = new SingleAnnotationServiceMock();

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [AllelesTableComponent],
      providers: [
        { provide: SingleAnnotationService, useValue: singleAnnotationServiceMock }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(AllelesTableComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
