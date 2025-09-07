import { ComponentFixture, TestBed } from '@angular/core/testing';

import { GmPickerComponent } from './gm-picker.component';

describe('GmPickerComponent', () => {
  let component: GmPickerComponent;
  let fixture: ComponentFixture<GmPickerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GmPickerComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(GmPickerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
