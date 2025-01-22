import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RegulationsComponent } from './regulations.component';

describe('RegulationsComponent', () => {
  let component: RegulationsComponent;
  let fixture: ComponentFixture<RegulationsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RegulationsComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(RegulationsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
