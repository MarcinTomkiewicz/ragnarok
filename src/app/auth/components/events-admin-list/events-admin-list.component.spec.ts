import { ComponentFixture, TestBed } from '@angular/core/testing';

import { EventsAdminListComponent } from './events-admin-list.component';

describe('EventsAdminListComponent', () => {
  let component: EventsAdminListComponent;
  let fixture: ComponentFixture<EventsAdminListComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EventsAdminListComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(EventsAdminListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
