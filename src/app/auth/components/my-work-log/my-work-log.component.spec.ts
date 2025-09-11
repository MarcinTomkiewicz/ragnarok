import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MyWorkLogComponent } from './my-work-log.component';

describe('MyWorkLogComponent', () => {
  let component: MyWorkLogComponent;
  let fixture: ComponentFixture<MyWorkLogComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MyWorkLogComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(MyWorkLogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
