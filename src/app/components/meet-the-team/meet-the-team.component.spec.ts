import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MeetTheTeamComponent } from './meet-the-team.component';

describe('MeetTheTeamComponent', () => {
  let component: MeetTheTeamComponent;
  let fixture: ComponentFixture<MeetTheTeamComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MeetTheTeamComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(MeetTheTeamComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
