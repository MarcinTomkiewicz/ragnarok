import { ComponentFixture, TestBed } from '@angular/core/testing';

import { StyleTagsComponent } from './style-tags.component';

describe('StyleTagsComponent', () => {
  let component: StyleTagsComponent;
  let fixture: ComponentFixture<StyleTagsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [StyleTagsComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(StyleTagsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
