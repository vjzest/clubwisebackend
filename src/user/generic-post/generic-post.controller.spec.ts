import { Test, TestingModule } from '@nestjs/testing';
import { GenericPostController } from './generic-post.controller';

describe('GenericPostController', () => {
  let controller: GenericPostController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [GenericPostController],
    }).compile();

    controller = module.get<GenericPostController>(GenericPostController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
