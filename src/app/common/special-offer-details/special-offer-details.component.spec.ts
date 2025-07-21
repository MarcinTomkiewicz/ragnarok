import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SpecialOfferDetailsComponent } from './special-offer-details.component';

describe('SpecialOfferDetailsComponent', () => {
  let component: SpecialOfferDetailsComponent;
  let fixture: ComponentFixture<SpecialOfferDetailsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SpecialOfferDetailsComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SpecialOfferDetailsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
