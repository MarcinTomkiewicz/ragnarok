import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PartyMembersPickerComponent } from './party-members-picker.component';

describe('PartyMembersPickerComponent', () => {
  let component: PartyMembersPickerComponent;
  let fixture: ComponentFixture<PartyMembersPickerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PartyMembersPickerComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PartyMembersPickerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
