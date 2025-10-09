import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BrandOffersComponent } from './brand-offers.component';

describe('BrandOffersComponent', () => {
  let component: BrandOffersComponent;
  let fixture: ComponentFixture<BrandOffersComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BrandOffersComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(BrandOffersComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
