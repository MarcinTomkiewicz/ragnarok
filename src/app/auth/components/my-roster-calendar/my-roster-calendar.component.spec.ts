import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MyRosterCalendarComponent } from './my-roster-calendar.component';

describe('MyRosterCalendarComponent', () => {
  let component: MyRosterCalendarComponent;
  let fixture: ComponentFixture<MyRosterCalendarComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MyRosterCalendarComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(MyRosterCalendarComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
