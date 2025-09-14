import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TriggerPickerComponent } from './trigger-picker.component';

describe('TriggerPickerComponent', () => {
  let component: TriggerPickerComponent;
  let fixture: ComponentFixture<TriggerPickerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TriggerPickerComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(TriggerPickerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
