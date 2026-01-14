// src/domains/domains.controller.ts
import {
    Controller,
    Post,
    Body,
    Put,
    Param,
    Patch,
    HttpCode,
    HttpStatus,
    UsePipes,
    ValidationPipe,
    Get,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CreateDomainDto } from './dto/create-domain.dto';
import { UpdateDomainDto } from './dto/update-domain.dto';
import { DomainService } from './domain.service';

@ApiTags('Admin - Domains')
@ApiBearerAuth()
@Controller('admin/domains')
export class DomainController {
    constructor(private readonly domainsService: DomainService) { }

    @Post()
    @UsePipes(new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidUnknownValues: true,
        transformOptions: {
            enableImplicitConversion: true,
        },
    }))
    @HttpCode(HttpStatus.CREATED)
    async create(@Body() createDto: CreateDomainDto) {
        console.log({ createDto });
        return this.domainsService.create(createDto);
    }

    @Put(':id')
    async update(
        @Param('id') id: string,
        @Body() updateDto: UpdateDomainDto,
    ) {
        return this.domainsService.update(id, updateDto);
    }

    @Patch(':id/toggle')
    async toggle(@Param('id') id: string) {
        return this.domainsService.toggleStatus(id);
    }

    @Get()
    async findAll() {
        return this.domainsService.findAll();
    }

    @Get(':id')
    async findById(@Param('id') id: string) {
        return this.domainsService.findById(id);
    }
}
