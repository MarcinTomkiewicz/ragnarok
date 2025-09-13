import { ComponentFixture, TestBed } from '@angular/core/testing';

import { WorkLogOverviewComponent } from './work-log-overview.component';

describe('WorkLogOverviewComponent', () => {
  let component: WorkLogOverviewComponent;
  let fixture: ComponentFixture<WorkLogOverviewComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WorkLogOverviewComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(WorkLogOverviewComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
