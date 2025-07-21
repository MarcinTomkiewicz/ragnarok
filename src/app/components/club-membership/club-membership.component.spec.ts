import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ClubMembershipComponent } from './club-membership.component';

describe('ClubMembershipComponent', () => {
  let component: ClubMembershipComponent;
  let fixture: ComponentFixture<ClubMembershipComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ClubMembershipComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ClubMembershipComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
