import { ComponentFixture, TestBed } from '@angular/core/testing';

import { EventHostsListComponent } from './event-hosts-list.component';

describe('EventHostsListComponent', () => {
  let component: EventHostsListComponent;
  let fixture: ComponentFixture<EventHostsListComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EventHostsListComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(EventHostsListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
