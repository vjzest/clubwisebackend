import { Test, TestingModule } from '@nestjs/testing';
import { StdAssetsController } from './standard-assets.controller';
import { StdAssetsService } from './standard-assets.service';

describe('StdAssetsController', () => {
  let controller: StdAssetsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [StdAssetsController],
      providers: [StdAssetsService],
    }).compile();

    controller = module.get<StdAssetsController>(StdAssetsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
