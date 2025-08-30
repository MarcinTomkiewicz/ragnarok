import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PartyDetailsModalComponent } from './party-details-modal.component';

describe('PartyDetailsModalComponent', () => {
  let component: PartyDetailsModalComponent;
  let fixture: ComponentFixture<PartyDetailsModalComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PartyDetailsModalComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PartyDetailsModalComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
