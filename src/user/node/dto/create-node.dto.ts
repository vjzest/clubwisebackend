import { IsOptional } from "class-validator";

export class CreateNodeDto {
  profileImage: Express.Multer.File;

  @IsOptional()
  coverImage: Express.Multer.File;

  name: string;

  about: string;

  description: string;

  location: string;
  removeCoverImage: boolean

  plugins: [{
    type: string;
    plugin: string;
  }];
  domain: [string];
}
