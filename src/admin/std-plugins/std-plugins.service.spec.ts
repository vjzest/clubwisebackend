import { Test, TestingModule } from '@nestjs/testing';
import { AdminStdPluginsService } from './std-plugins.service';

describe('StdPluginsService', () => {
  let service: AdminStdPluginsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AdminStdPluginsService],
    }).compile();

    service = module.get<AdminStdPluginsService>(AdminStdPluginsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
