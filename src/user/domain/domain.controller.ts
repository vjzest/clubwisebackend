import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { DomainService } from './domain.service';

@ApiTags('Domains')
@ApiBearerAuth()
@Controller('users/domains')
export class DomainController {
    constructor(private readonly domainService: DomainService) { }

    @Get()
    async findAll() {
        return this.domainService.findAll();
    }
}
