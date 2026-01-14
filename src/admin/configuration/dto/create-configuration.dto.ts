import { IsNotEmpty, IsNumber } from "class-validator";

export class CreateConfigurationDto {
    @IsNotEmpty()
    @IsNumber()
    assetCreationCount: number;
}