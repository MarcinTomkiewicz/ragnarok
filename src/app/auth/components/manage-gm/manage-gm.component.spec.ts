import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ManageGmComponent } from './manage-gm.component';

describe('ManageGmComponent', () => {
  let component: ManageGmComponent;
  let fixture: ComponentFixture<ManageGmComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ManageGmComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ManageGmComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
