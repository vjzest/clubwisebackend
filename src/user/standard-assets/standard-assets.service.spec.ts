import { Test, TestingModule } from '@nestjs/testing';
import { StdAssetsService } from './standard-assets.service';

describe('StandardAssetsService', () => {
  let service: StdAssetsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [StdAssetsService],
    }).compile();

    service = module.get<StdAssetsService>(StdAssetsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
