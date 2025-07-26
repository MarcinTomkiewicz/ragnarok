import { ComponentFixture, TestBed } from '@angular/core/testing';

import { UpcomingSessionsComponent } from './upcoming-sessions.component';

describe('UpcomingSessionsComponent', () => {
  let component: UpcomingSessionsComponent;
  let fixture: ComponentFixture<UpcomingSessionsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [UpcomingSessionsComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(UpcomingSessionsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
