import { TestBed } from '@angular/core/testing';

import { CoworkerDirectoryService } from './coworker-directory.service';

describe('CoworkerDirectoryService', () => {
  let service: CoworkerDirectoryService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(CoworkerDirectoryService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
