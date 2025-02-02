import { ComponentFixture, TestBed } from '@angular/core/testing';

import { OurRoomsComponent } from './our-rooms.component';

describe('OurRoomsComponent', () => {
  let component: OurRoomsComponent;
  let fixture: ComponentFixture<OurRoomsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [OurRoomsComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(OurRoomsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
