import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ReservationStepperComponent } from './reservation-stepper.component';

describe('ReservationStepperComponent', () => {
  let component: ReservationStepperComponent;
  let fixture: ComponentFixture<ReservationStepperComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ReservationStepperComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ReservationStepperComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
