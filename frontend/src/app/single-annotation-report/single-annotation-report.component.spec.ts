import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SingleAnnotationReportComponent } from './single-annotation-report.component';
import { BehaviorSubject } from 'rxjs';
import {
  Annotator,
  AnnotatorDetails,
  Attribute,
  Resource,
  Result,
  SingleAnnotationReport,
  Variant
} from '../single-annotation';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { provideMarkdown } from 'ngx-markdown';
import { JobsService } from '../job-creation/jobs.service';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import FileSaver from 'file-saver';


describe('SingleAnnotationReportComponent', () => {
  let component: SingleAnnotationReportComponent;
  let fixture: ComponentFixture<SingleAnnotationReportComponent>;

  beforeEach(async() => {
    await TestBed.configureTestingModule({
      imports: [SingleAnnotationReportComponent],
      providers: [
        JobsService,
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        provideMarkdown()
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(SingleAnnotationReportComponent);
    component = fixture.componentInstance;

    const activatedRoute = TestBed.inject(ActivatedRoute);
    (activatedRoute.queryParams as BehaviorSubject<{variant: string, pipeline: string}>).next({
      variant: 'chr14 204000100 A AA',
      pipeline: 'pipeline'
    });

    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should display true, false and 0 when there is no histogram', () => {
    const report = new SingleAnnotationReport(
      new Variant('chr14', 204000100, 'A', 'AA', 'ins'),
      [
        new Annotator(new AnnotatorDetails('allele_score', 'desc', [new Resource('resourceId', 'resourceUrl')]), [
          new Attribute('attr1', 'desc1', 'AF', {value: 'true', histogramLink: null} as Result, ''),
          new Attribute('attr2', 'desc2', 'AF', {value: 'false', histogramLink: null} as Result, ''),
          new Attribute('attr3', 'desc3', 'AF', {value: 0, histogramLink: null} as Result, ''),
        ])
      ],
    );

    component.report = report;
    fixture.detectChanges();

    const allValueElements = (fixture.nativeElement as HTMLElement).querySelectorAll('.value-result');
    expect(allValueElements).toHaveLength(3);
    expect(allValueElements[0].innerHTML).toBe('true');
    expect(allValueElements[1].innerHTML).toBe('false');
    expect(allValueElements[2].innerHTML).toBe('0');
  });

  it('should save report as file', async() => {
    const saveAsSpy = jest.spyOn(FileSaver, 'saveAs').mockImplementation(() => null);

    const report = new SingleAnnotationReport(
      new Variant('chr14', 204000100, 'A', 'AA', 'ins'),
      [
        new Annotator(new AnnotatorDetails('allele_score', 'desc', [new Resource('resourceId', 'resourceUrl')]), [
          new Attribute('attr1', 'desc1', 'AF', {value: 'true', histogramLink: null} as Result, ''),
          new Attribute('attr2', 'desc2', 'AF', {value: 13, histogramLink: null} as Result, ''),
          new Attribute('attr3', 'desc3', 'AF', {value: 'mock_value', histogramLink: null} as Result, ''),
          new Attribute('attr4', 'desc4', 'AF',
            {value: new Map<string, number>([['fo', 5], ['po', 3]]), histogramLink: null} as Result, ''
          ),
        ])
      ],
    );

    component.report = report;
    component.saveReport();

    expect(saveAsSpy.mock.calls[0][1]).toBe('chr14_204000100_A_AA_report.tsv');
    const savedBlob = saveAsSpy.mock.calls[0][0] as Blob;

    const savedText = await savedBlob.text();
    const expectedText = 'Attribute name\tValue\nattr1\ttrue\nattr2\t13\nattr3\tmock_value\nattr4\tfo:5;po:3\n';
    expect(savedText).toBe(expectedText);
  });
});
