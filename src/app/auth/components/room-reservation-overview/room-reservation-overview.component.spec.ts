import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RoomReservationOverviewComponent } from './room-reservation-overview.component';

describe('RoomReservationOverviewComponent', () => {
  let component: RoomReservationOverviewComponent;
  let fixture: ComponentFixture<RoomReservationOverviewComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RoomReservationOverviewComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(RoomReservationOverviewComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
