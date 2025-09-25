import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CoworkerPersonalFilesComponent } from './coworker-personal-files.component';

describe('CoworkerPersonalFilesComponent', () => {
  let component: CoworkerPersonalFilesComponent;
  let fixture: ComponentFixture<CoworkerPersonalFilesComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CoworkerPersonalFilesComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CoworkerPersonalFilesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
