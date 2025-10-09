import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ReceptionScheduleComponent } from './reception-schedule.component';

describe('ReceptionScheduleComponent', () => {
  let component: ReceptionScheduleComponent;
  let fixture: ComponentFixture<ReceptionScheduleComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ReceptionScheduleComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ReceptionScheduleComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
