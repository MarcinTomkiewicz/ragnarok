import { ComponentFixture, TestBed } from '@angular/core/testing';

import { OffersPageComponent } from './offers-page.component';

describe('OffersPageComponent', () => {
  let component: OffersPageComponent;
  let fixture: ComponentFixture<OffersPageComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [OffersPageComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(OffersPageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
