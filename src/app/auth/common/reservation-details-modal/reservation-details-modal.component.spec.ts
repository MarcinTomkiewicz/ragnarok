import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ReservationDetailsModalComponent } from './reservation-details-modal.component';

describe('ReservationDetailsModalComponent', () => {
  let component: ReservationDetailsModalComponent;
  let fixture: ComponentFixture<ReservationDetailsModalComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ReservationDetailsModalComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ReservationDetailsModalComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
