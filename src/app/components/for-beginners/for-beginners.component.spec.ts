import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ForBeginnersComponent } from './for-beginners.component';

describe('ForBeginnersComponent', () => {
  let component: ForBeginnersComponent;
  let fixture: ComponentFixture<ForBeginnersComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ForBeginnersComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ForBeginnersComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
