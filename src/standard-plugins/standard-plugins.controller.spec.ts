import { Test, TestingModule } from '@nestjs/testing';
import { UserStdPluginsController } from './standard-plugins.controller';
import { UserStdPluginsService } from './standard-plugins.service';

describe('StdPluginsController', () => {
  let controller: UserStdPluginsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UserStdPluginsController],
      providers: [UserStdPluginsService],
    }).compile();

    controller = module.get<UserStdPluginsController>(UserStdPluginsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
