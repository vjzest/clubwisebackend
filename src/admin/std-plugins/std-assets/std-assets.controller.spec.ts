import { Test, TestingModule } from '@nestjs/testing';
import { StdAssetsController } from './std-assets.controller';
import { AdminStdAssetsService } from './std-assets.service';

describe('StdAssetsController', () => {
  let controller: StdAssetsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [StdAssetsController],
      providers: [AdminStdAssetsService],
    }).compile();

    controller = module.get<StdAssetsController>(StdAssetsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
