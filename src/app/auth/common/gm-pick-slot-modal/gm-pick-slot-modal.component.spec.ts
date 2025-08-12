import { ComponentFixture, TestBed } from '@angular/core/testing';

import { GmPickSlotModalComponent } from './gm-pick-slot-modal.component';

describe('GmPickSlotModalComponent', () => {
  let component: GmPickSlotModalComponent;
  let fixture: ComponentFixture<GmPickSlotModalComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GmPickSlotModalComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(GmPickSlotModalComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
