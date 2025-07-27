import { ComponentFixture, TestBed } from '@angular/core/testing';

import { GmDetailsModalComponent } from './gm-details-modal.component';

describe('GmDetailsModalComponent', () => {
  let component: GmDetailsModalComponent;
  let fixture: ComponentFixture<GmDetailsModalComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GmDetailsModalComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(GmDetailsModalComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
