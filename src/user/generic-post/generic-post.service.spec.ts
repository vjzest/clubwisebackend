import { Test, TestingModule } from '@nestjs/testing';
import { GenericPostService } from './generic-post.service';

describe('GenericPostService', () => {
  let service: GenericPostService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [GenericPostService],
    }).compile();

    service = module.get<GenericPostService>(GenericPostService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
