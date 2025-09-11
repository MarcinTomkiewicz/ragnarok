import { TestBed } from '@angular/core/testing';

import { WorkLogService } from './work-log.service';

describe('WorkLogService', () => {
  let service: WorkLogService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(WorkLogService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
