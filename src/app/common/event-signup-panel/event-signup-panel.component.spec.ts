import { ComponentFixture, TestBed } from '@angular/core/testing';

import { EventSignupPanelComponent } from './event-signup-panel.component';

describe('EventSignupPanelComponent', () => {
  let component: EventSignupPanelComponent;
  let fixture: ComponentFixture<EventSignupPanelComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EventSignupPanelComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(EventSignupPanelComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
