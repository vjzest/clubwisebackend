import { PartialType } from '@nestjs/mapped-types';
import { CreateHistoryTimelineDto } from './create-history-timeline.dto';

export class UpdateHistoryTimelineDto extends PartialType(CreateHistoryTimelineDto) { }
