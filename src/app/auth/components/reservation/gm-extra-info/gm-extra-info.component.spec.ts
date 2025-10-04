import { ComponentFixture, TestBed } from '@angular/core/testing';

import { GmExtraInfoComponent } from './gm-extra-info.component';

describe('GmExtraInfoComponent', () => {
  let component: GmExtraInfoComponent;
  let fixture: ComponentFixture<GmExtraInfoComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GmExtraInfoComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(GmExtraInfoComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
