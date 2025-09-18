import { ComponentFixture, TestBed } from '@angular/core/testing';

import { EventSessionDetailsModalComponent } from './event-session-details-modal.component';

describe('EventSessionDetailsModalComponent', () => {
  let component: EventSessionDetailsModalComponent;
  let fixture: ComponentFixture<EventSessionDetailsModalComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EventSessionDetailsModalComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(EventSessionDetailsModalComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
