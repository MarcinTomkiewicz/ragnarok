import { TestBed } from '@angular/core/testing';

import { ViewResolverService } from './view-resolver.service';

describe('ViewResolverService', () => {
  let service: ViewResolverService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ViewResolverService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
