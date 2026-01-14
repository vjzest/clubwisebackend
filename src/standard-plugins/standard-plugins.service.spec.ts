import { Test, TestingModule } from '@nestjs/testing';
import { UserStdPluginsService } from './standard-plugins.service';

describe('StdPluginsService', () => {
  let service: UserStdPluginsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [UserStdPluginsService],
    }).compile();

    service = module.get<UserStdPluginsService>(UserStdPluginsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
