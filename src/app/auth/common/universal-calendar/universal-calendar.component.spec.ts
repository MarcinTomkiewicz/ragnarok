import { ComponentFixture, TestBed } from '@angular/core/testing';

import { UniversalCalendarComponent } from './universal-calendar.component';

describe('UniversalCalendarComponent', () => {
  let component: UniversalCalendarComponent;
  let fixture: ComponentFixture<UniversalCalendarComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [UniversalCalendarComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(UniversalCalendarComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
