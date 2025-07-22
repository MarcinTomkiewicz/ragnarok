import { ComponentFixture, TestBed } from '@angular/core/testing';

import { UserMenuPanelComponent } from './user-menu-panel.component';

describe('UserMenuPanelComponent', () => {
  let component: UserMenuPanelComponent;
  let fixture: ComponentFixture<UserMenuPanelComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [UserMenuPanelComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(UserMenuPanelComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
