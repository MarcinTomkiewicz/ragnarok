import { TestBed } from '@angular/core/testing';

import { GmDirectoryService } from './gm-directory.service';

describe('GmDirectoryService', () => {
  let service: GmDirectoryService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(GmDirectoryService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
