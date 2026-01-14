import { Module } from '@nestjs/common';
import { CommonService } from './common.service';
import { SharedModule } from '../../shared/shared.module';

@Module({
    imports: [SharedModule],
    providers: [CommonService],
    exports: [CommonService],
})
export class CommonModule { }