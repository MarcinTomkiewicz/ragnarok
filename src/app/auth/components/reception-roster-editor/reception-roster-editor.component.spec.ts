import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ReceptionRosterEditorComponent } from './reception-roster-editor.component';

describe('ReceptionRosterEditorComponent', () => {
  let component: ReceptionRosterEditorComponent;
  let fixture: ComponentFixture<ReceptionRosterEditorComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ReceptionRosterEditorComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ReceptionRosterEditorComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
