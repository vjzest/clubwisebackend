import { Test, TestingModule } from '@nestjs/testing';
import { AdminStdPluginsController } from './std-plugins.controller';

describe('StdPluginsController', () => {
  let controller: AdminStdPluginsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminStdPluginsController],
    }).compile();

    controller = module.get<AdminStdPluginsController>(AdminStdPluginsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
