import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SessionSignupButtonComponent } from './session-signup-button.component';

describe('SessionSignupButtonComponent', () => {
  let component: SessionSignupButtonComponent;
  let fixture: ComponentFixture<SessionSignupButtonComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SessionSignupButtonComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SessionSignupButtonComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
