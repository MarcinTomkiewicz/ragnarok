import { TestBed } from '@angular/core/testing';

import { EventHostsService } from './event-hosts.service';

describe('EventHostsService', () => {
  let service: EventHostsService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(EventHostsService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
