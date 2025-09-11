import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ReceptionAvailabilityComponent } from './reception-availability.component';

describe('ReceptionAvailabilityComponent', () => {
  let component: ReceptionAvailabilityComponent;
  let fixture: ComponentFixture<ReceptionAvailabilityComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ReceptionAvailabilityComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ReceptionAvailabilityComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
