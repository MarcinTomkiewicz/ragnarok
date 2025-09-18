import { ComponentFixture, TestBed } from '@angular/core/testing';

import { HostSignupFormComponent } from './host-signup-form.component';

describe('HostSignupFormComponent', () => {
  let component: HostSignupFormComponent;
  let fixture: ComponentFixture<HostSignupFormComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HostSignupFormComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(HostSignupFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
