import { ComponentFixture, TestBed } from '@angular/core/testing';

import { WorklogExportComponent } from './worklog-export.component';

describe('WorklogExportComponent', () => {
  let component: WorklogExportComponent;
  let fixture: ComponentFixture<WorklogExportComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WorklogExportComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(WorklogExportComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
