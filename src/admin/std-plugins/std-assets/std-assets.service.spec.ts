import { Test, TestingModule } from '@nestjs/testing';
import { AdminStdAssetsService } from './std-assets.service';

describe('StdAssetsService', () => {
  let service: AdminStdAssetsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AdminStdAssetsService],
    }).compile();

    service = module.get<AdminStdAssetsService>(AdminStdAssetsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
