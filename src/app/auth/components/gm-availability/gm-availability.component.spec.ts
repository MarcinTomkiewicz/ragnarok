import { ComponentFixture, TestBed } from '@angular/core/testing';

import { GmAvailabilityComponent } from './gm-availability.component';

describe('GmAvailabilityComponent', () => {
  let component: GmAvailabilityComponent;
  let fixture: ComponentFixture<GmAvailabilityComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GmAvailabilityComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(GmAvailabilityComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
