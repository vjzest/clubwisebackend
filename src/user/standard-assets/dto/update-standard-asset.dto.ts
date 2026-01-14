import { PartialType } from '@nestjs/swagger';
import { CreateStdAssetDto } from './create-standard-asset.dto';

export class UpdateStdAssetDto extends PartialType(CreateStdAssetDto) { }
