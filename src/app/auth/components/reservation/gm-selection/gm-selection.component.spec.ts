import { ComponentFixture, TestBed } from '@angular/core/testing';

import { GmSelectionComponent } from './gm-selection.component';

describe('GmSelectionComponent', () => {
  let component: GmSelectionComponent;
  let fixture: ComponentFixture<GmSelectionComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GmSelectionComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(GmSelectionComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
