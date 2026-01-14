import { IsString, IsNotEmpty, IsMongoId } from 'class-validator';

export class SubmitResponseDto {
    @IsMongoId()
    @IsNotEmpty()
    strategicNeedId: string;

    @IsString()
    @IsNotEmpty()
    contactInfo: string;

    @IsString()
    @IsNotEmpty()
    message: string;
}
