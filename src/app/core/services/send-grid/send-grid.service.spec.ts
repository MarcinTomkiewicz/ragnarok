import { TestBed } from '@angular/core/testing';

import { SendGridService } from './send-grid.service';

describe('SendGridService', () => {
  let service: SendGridService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(SendGridService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
