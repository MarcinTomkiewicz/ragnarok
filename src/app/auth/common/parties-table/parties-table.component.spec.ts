import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PartiesTableComponent } from './parties-table.component';

describe('PartiesTableComponent', () => {
  let component: PartiesTableComponent;
  let fixture: ComponentFixture<PartiesTableComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PartiesTableComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PartiesTableComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
