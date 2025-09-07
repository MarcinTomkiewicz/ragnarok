import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SystemsPickerComponent } from './systems-picker.component';

describe('SystemsPickerComponent', () => {
  let component: SystemsPickerComponent;
  let fixture: ComponentFixture<SystemsPickerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SystemsPickerComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SystemsPickerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
