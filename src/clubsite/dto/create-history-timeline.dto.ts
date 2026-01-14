import {
    IsInt,
    IsNotEmpty,
    IsOptional,
    IsString,
    MaxLength,
    IsMongoId,
    Validate,
    ValidatorConstraint,
    ValidatorConstraintInterface,
    ValidationArguments,
    ValidateIf,
    registerDecorator,
    ValidationOptions,
} from 'class-validator';

const CURRENT_YEAR = new Date().getFullYear();
const MIN_YEAR = CURRENT_YEAR - 100;
const MAX_YEAR = CURRENT_YEAR;

@ValidatorConstraint({ name: 'IsValidYearRange', async: false })
class IsValidYearRangeConstraint implements ValidatorConstraintInterface {
    validate(year: number) {
        return typeof year === 'number' && year >= MIN_YEAR && year <= MAX_YEAR;
    }

    defaultMessage() {
        return `Year must be between ${MIN_YEAR} and ${MAX_YEAR}`;
    }
}

@ValidatorConstraint({ name: 'AtLeastOneRelation', async: false })
class AtLeastOneRelationConstraint implements ValidatorConstraintInterface {
    validate(object: any) {
        return Boolean(object.node || object.club || object.chapter);
    }

    defaultMessage() {
        return 'At least one of node, club, or chapter must be provided.';
    }
}

export class CreateHistoryTimelineDto {
    @IsInt()
    @Validate(IsValidYearRangeConstraint)
    year: number;

    @IsString()
    @IsNotEmpty()
    @MaxLength(100)
    title: string;

    @IsString()
    @IsNotEmpty()
    @MaxLength(1000)
    description: string;

    @IsOptional()
    @IsMongoId()
    node?: string;

    @IsOptional()
    @IsMongoId()
    club?: string;

    @IsOptional()
    @IsMongoId()
    chapter?: string;

    // 👇 Apply the custom class-level validator
    @Validate(AtLeastOneRelationConstraint)
    checkAtLeastOneRelation: any;
}
