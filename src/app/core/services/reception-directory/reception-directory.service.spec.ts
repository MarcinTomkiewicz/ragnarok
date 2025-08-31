import { TestBed } from '@angular/core/testing';

import { ReceptionDirectoryService } from './reception-directory.service';

describe('ReceptionDirectoryService', () => {
  let service: ReceptionDirectoryService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ReceptionDirectoryService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
